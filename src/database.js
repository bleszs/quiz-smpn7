const crypto = require('node:crypto');
const { Pool } = require('pg');

function createDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    return {
      enabled: false,
      pool: null,
      async initialize() {},
      async close() {}
    };
  }

  const pool = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  async function initialize(defaultQuestions) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quizzes (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
        created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY,
        quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT '',
        prompt TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_option_index INTEGER NOT NULL CHECK (correct_option_index BETWEEN 0 AND 3),
        explanation TEXT NOT NULL DEFAULT '',
        time_limit_ms INTEGER NOT NULL DEFAULT 10000 CHECK (time_limit_ms BETWEEN 3000 AND 120000),
        base_points INTEGER NOT NULL DEFAULT 1000 CHECK (base_points BETWEEN 0 AND 100000),
        position INTEGER NOT NULL,
        image_url TEXT NOT NULL DEFAULT '',
        alt_text TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (quiz_id, position)
      );

      CREATE TABLE IF NOT EXISTS game_sessions (
        id UUID PRIMARY KEY,
        quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
        room_code VARCHAR(6) NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'question', 'reveal', 'finished', 'interrupted')),
        current_question_index INTEGER NOT NULL DEFAULT -1,
        question_started_at TIMESTAMPTZ,
        settings_snapshot JSONB NOT NULL,
        started_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS participants (
        id UUID PRIMARY KEY,
        game_session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
        nickname TEXT NOT NULL,
        class_name TEXT NOT NULL DEFAULT '',
        session_token_hash TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        correct_count INTEGER NOT NULL DEFAULT 0,
        max_streak INTEGER NOT NULL DEFAULT 0,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (game_session_id, nickname, class_name)
      );

      CREATE TABLE IF NOT EXISTS answers (
        id UUID PRIMARY KEY,
        game_session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
        participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
        question_snapshot JSONB NOT NULL,
        selected_option_index INTEGER NOT NULL CHECK (selected_option_index BETWEEN 0 AND 3),
        is_correct BOOLEAN NOT NULL,
        response_time_ms INTEGER NOT NULL,
        points_awarded INTEGER NOT NULL DEFAULT 0,
        answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (participant_id, question_id)
      );

      CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id, position);
      CREATE INDEX IF NOT EXISTS idx_sessions_quiz ON game_sessions(quiz_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(game_session_id, score DESC);
      CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(game_session_id, answered_at);
    `);

    // Removes only records created by the automated production integration test.
    await pool.query("DELETE FROM game_sessions WHERE settings_snapshot->>'title' LIKE 'Codex Integration %'");
    await pool.query("DELETE FROM quizzes WHERE title LIKE 'Codex Integration %'");
    await pool.query("DELETE FROM admins WHERE email LIKE 'codex-test-%@example.invalid'");

    const existing = await pool.query('SELECT id FROM quizzes WHERE deleted_at IS NULL LIMIT 1');
    if (existing.rowCount === 0 && Array.isArray(defaultQuestions) && defaultQuestions.length) {
      const quizId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO quizzes (id, title, description, status)
         VALUES ($1, $2, $3, 'published')`,
        [quizId, 'Medan Simpang', 'Kuis pengenalan kawasan dan rute Medan Simpang.']
      );
      await replaceQuestions(quizId, defaultQuestions.map((question, index) => ({
        category: question.category,
        prompt: question.question,
        options: question.options,
        correctOptionIndex: question.options.indexOf(question.correct),
        explanation: question.explanation,
        timeLimitMs: 10_000,
        basePoints: 1000,
        position: index + 1,
        imageUrl: question.image,
        altText: question.alt
      })));
    }
  }

  function normalizeQuestion(row) {
    return {
      id: row.id,
      category: row.category,
      question: row.prompt,
      options: row.options,
      correctIndex: row.correct_option_index,
      correct: row.options[row.correct_option_index],
      explanation: row.explanation,
      timeLimitMs: row.time_limit_ms,
      basePoints: row.base_points,
      position: row.position,
      image: row.image_url,
      alt: row.alt_text
    };
  }

  async function listQuizzes() {
    const result = await pool.query(`
      SELECT q.id, q.title, q.description, q.status, q.created_at, q.updated_at,
             COUNT(questions.id)::INTEGER AS question_count
      FROM quizzes q
      LEFT JOIN questions ON questions.quiz_id = q.id
      WHERE q.deleted_at IS NULL
      GROUP BY q.id
      ORDER BY q.updated_at DESC
    `);
    return result.rows;
  }

  async function getQuiz(id) {
    const quiz = await pool.query(
      'SELECT id, title, description, status, created_at, updated_at FROM quizzes WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (!quiz.rowCount) return null;
    const questions = await pool.query('SELECT * FROM questions WHERE quiz_id = $1 ORDER BY position', [id]);
    return { ...quiz.rows[0], questions: questions.rows.map(normalizeQuestion) };
  }

  async function createQuiz({ title, description, status = 'draft', createdBy }) {
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO quizzes (id, title, description, status, created_by) VALUES ($1, $2, $3, $4, $5)',
      [id, title, description || '', status, createdBy || null]
    );
    return getQuiz(id);
  }

  async function updateQuiz(id, { title, description, status }) {
    const result = await pool.query(
      `UPDATE quizzes SET title = $2, description = $3, status = $4, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id, title, description || '', status]
    );
    return result.rowCount ? getQuiz(id) : null;
  }

  async function replaceQuestions(quizId, questions) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM questions WHERE quiz_id = $1', [quizId]);
      for (let index = 0; index < questions.length; index += 1) {
        const question = questions[index];
        await client.query(
          `INSERT INTO questions
           (id, quiz_id, category, prompt, options, correct_option_index, explanation, time_limit_ms, base_points, position, image_url, alt_text)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12)`,
          [
            crypto.randomUUID(), quizId, question.category || '', question.prompt,
            JSON.stringify(question.options), question.correctOptionIndex, question.explanation || '',
            question.timeLimitMs, question.basePoints, index + 1, question.imageUrl || '', question.altText || ''
          ]
        );
      }
      await client.query('UPDATE quizzes SET updated_at = NOW() WHERE id = $1', [quizId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return getQuiz(quizId);
  }

  async function archiveQuiz(id) {
    const result = await pool.query(
      "UPDATE quizzes SET status = 'archived', deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    return result.rowCount > 0;
  }

  async function countAdmins() {
    const result = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM admins');
    return result.rows[0].count;
  }

  async function createAdmin(email, passwordHash) {
    const id = crypto.randomUUID();
    const result = await pool.query(
      'INSERT INTO admins (id, email, password_hash) VALUES ($1, LOWER($2), $3) RETURNING id, email',
      [id, email, passwordHash]
    );
    return result.rows[0];
  }

  async function findAdminByEmail(email) {
    const result = await pool.query('SELECT id, email, password_hash FROM admins WHERE email = LOWER($1)', [email]);
    return result.rows[0] || null;
  }

  async function createGameSession({ id, quizId, roomCode, snapshot }) {
    await pool.query(
      `INSERT INTO game_sessions (id, quiz_id, room_code, settings_snapshot)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [id, quizId || null, roomCode, JSON.stringify(snapshot)]
    );
  }

  async function updateGameSession(id, status, currentQuestionIndex, questionStartedAt) {
    await pool.query(
      `UPDATE game_sessions SET status = $2, current_question_index = $3,
       question_started_at = $4, started_at = CASE WHEN $2 = 'question' AND started_at IS NULL THEN NOW() ELSE started_at END,
       ended_at = CASE WHEN $2 = 'finished' THEN NOW() ELSE ended_at END, updated_at = NOW() WHERE id = $1`,
      [id, status, currentQuestionIndex, questionStartedAt ? new Date(questionStartedAt) : null]
    );
  }

  async function addParticipant(sessionId, participant) {
    const tokenHash = crypto.createHash('sha256').update(participant.token).digest('hex');
    await pool.query(
      `INSERT INTO participants (id, game_session_id, nickname, class_name, session_token_hash, joined_at)
       VALUES ($1, $2, $3, $4, $5, TO_TIMESTAMP($6 / 1000.0))`,
      [participant.id, sessionId, participant.name, participant.className, tokenHash, participant.joinedAt]
    );
  }

  async function recordAnswer(sessionId, participant, question, questionIndex, answerIndex, isCorrect, responseTimeMs, points) {
    await pool.query(
      `INSERT INTO answers
       (id, game_session_id, participant_id, question_id, question_snapshot, selected_option_index, is_correct, response_time_ms, points_awarded)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
       ON CONFLICT (participant_id, question_id) DO NOTHING`,
      [
        crypto.randomUUID(), sessionId, participant.id, question.id || null,
        JSON.stringify({ index: questionIndex, prompt: question.question, options: question.options }),
        answerIndex, isCorrect, responseTimeMs, points
      ]
    );
  }

  async function finishGameSession(sessionId, participants) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE participants AS stored
         SET score = incoming.score,
             correct_count = incoming.correct_count,
             max_streak = incoming.max_streak,
             last_seen_at = NOW()
         FROM jsonb_to_recordset($2::jsonb)
           AS incoming(id UUID, score INTEGER, correct_count INTEGER, max_streak INTEGER)
         WHERE stored.id = incoming.id AND stored.game_session_id = $1`,
        [sessionId, JSON.stringify(participants.map((participant) => ({
          id: participant.id,
          score: participant.score,
          correct_count: participant.correctCount,
          max_streak: participant.maxStreak
        })))]
      );
      await client.query(
        "UPDATE game_sessions SET status = 'finished', ended_at = NOW(), updated_at = NOW() WHERE id = $1",
        [sessionId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function listGameResults(limit = 50) {
    const result = await pool.query(
      `SELECT gs.id, gs.room_code, gs.status, gs.started_at, gs.ended_at, q.title AS quiz_title,
              COUNT(p.id)::INTEGER AS participant_count
       FROM game_sessions gs
       LEFT JOIN quizzes q ON q.id = gs.quiz_id
       LEFT JOIN participants p ON p.game_session_id = gs.id
       GROUP BY gs.id, q.title
       ORDER BY gs.created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async function getGameResult(id) {
    const sessionResult = await pool.query(
      `SELECT gs.id, gs.room_code, gs.status, gs.started_at, gs.ended_at, gs.settings_snapshot,
              q.title AS quiz_title
       FROM game_sessions gs LEFT JOIN quizzes q ON q.id = gs.quiz_id WHERE gs.id = $1`,
      [id]
    );
    if (!sessionResult.rowCount) return null;
    const participants = await pool.query(
      `SELECT id, nickname, class_name, score, correct_count, max_streak, joined_at
       FROM participants WHERE game_session_id = $1
       ORDER BY score DESC, correct_count DESC, joined_at`,
      [id]
    );
    const answers = await pool.query(
      `SELECT participant_id, question_snapshot, selected_option_index, is_correct,
              response_time_ms, points_awarded, answered_at
       FROM answers WHERE game_session_id = $1 ORDER BY answered_at`,
      [id]
    );
    return {
      ...sessionResult.rows[0],
      participants: participants.rows.map((participant, index) => ({ ...participant, rank: index + 1 })),
      answers: answers.rows
    };
  }

  return {
    enabled: true,
    pool,
    initialize,
    close: () => pool.end(),
    listQuizzes,
    getQuiz,
    createQuiz,
    updateQuiz,
    replaceQuestions,
    archiveQuiz,
    countAdmins,
    createAdmin,
    findAdminByEmail,
    createGameSession,
    updateGameSession,
    addParticipant,
    recordAnswer,
    finishGameSession,
    listGameResults,
    getGameResult
  };
}

module.exports = { createDatabase };
