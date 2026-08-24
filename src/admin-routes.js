const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');

function clean(value, maxLength = 200) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function validateQuiz(body) {
  const title = clean(body.title, 100);
  const description = clean(body.description, 500);
  const status = ['draft', 'published', 'archived'].includes(body.status) ? body.status : 'draft';
  if (title.length < 3) return { error: 'Judul quiz minimal 3 karakter.' };
  return { value: { title, description, status } };
}

function validateQuestions(body) {
  if (!Array.isArray(body.questions) || body.questions.length > 100) {
    return { error: 'Pertanyaan harus berupa daftar dengan maksimal 100 soal.' };
  }
  const questions = [];
  for (let index = 0; index < body.questions.length; index += 1) {
    const source = body.questions[index] || {};
    const prompt = clean(source.prompt, 500);
    const options = Array.isArray(source.options) ? source.options.map((option) => clean(option, 200)) : [];
    const correctOptionIndex = Number(source.correctOptionIndex);
    const timeLimitMs = Math.round(Number(source.timeLimitSeconds || 10) * 1000);
    const basePoints = Math.round(Number(source.basePoints || 1000));
    if (prompt.length < 3 || options.length !== 4 || options.some((option) => !option)) {
      return { error: `Soal ${index + 1} harus memiliki pertanyaan dan empat pilihan lengkap.` };
    }
    if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex > 3) {
      return { error: `Jawaban benar soal ${index + 1} tidak valid.` };
    }
    if (timeLimitMs < 3_000 || timeLimitMs > 120_000) {
      return { error: `Timer soal ${index + 1} harus antara 3 dan 120 detik.` };
    }
    if (basePoints < 0 || basePoints > 100_000) {
      return { error: `Poin soal ${index + 1} tidak valid.` };
    }
    questions.push({
      prompt,
      options,
      correctOptionIndex,
      category: clean(source.category, 80),
      explanation: clean(source.explanation, 500),
      timeLimitMs,
      basePoints,
      imageUrl: clean(source.imageUrl, 500),
      altText: clean(source.altText, 250)
    });
  }
  return { value: questions };
}

function validateQuestion(body) {
  const validated = validateQuestions({ questions: [body] });
  if (validated.error) return validated;
  return { value: validated.value[0] };
}

function createAdminRouter(database) {
  const router = express.Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { ok: false, error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' }
  });

  function requireDatabase(_request, response, next) {
    if (!database.enabled) return response.status(503).json({ ok: false, error: 'Database belum dikonfigurasi.' });
    next();
  }

  function requireAdmin(request, response, next) {
    if (!request.session?.adminId) return response.status(401).json({ ok: false, error: 'Silakan login sebagai admin.' });
    next();
  }

  router.use(requireDatabase);

  router.get('/session', async (request, response, next) => {
    try {
      const adminCount = await database.countAdmins();
      response.json({
        ok: true,
        authenticated: Boolean(request.session?.adminId),
        admin: request.session?.adminId ? { id: request.session.adminId, username: request.session.adminUsername } : null,
        setupRequired: adminCount === 0
      });
    } catch (error) { next(error); }
  });

  router.post('/setup', loginLimiter, async (request, response, next) => {
    try {
      if (await database.countAdmins()) return response.status(409).json({ ok: false, error: 'Admin awal sudah dibuat.' });
      const expectedToken = process.env.ADMIN_SETUP_TOKEN;
      if (!expectedToken || !secureEqual(request.body.setupToken, expectedToken)) {
        return response.status(403).json({ ok: false, error: 'Setup token tidak valid.' });
      }
      const username = clean(request.body.username, 40).toLowerCase();
      const password = String(request.body.password || '');
      if (!/^[a-z0-9._-]{4,40}$/.test(username)) {
        return response.status(400).json({ ok: false, error: 'Username minimal 4 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.' });
      }
      if (password.length < 10 || password.length > 128) {
        return response.status(400).json({ ok: false, error: 'Password minimal 10 karakter.' });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const admin = await database.createAdmin(username, passwordHash);
      request.session.adminId = admin.id;
      request.session.adminUsername = admin.username;
      response.status(201).json({ ok: true, admin });
    } catch (error) { next(error); }
  });

  router.post('/login', loginLimiter, async (request, response, next) => {
    try {
      const username = clean(request.body.username, 40).toLowerCase();
      const admin = await database.findAdminByUsername(username);
      const valid = admin && await bcrypt.compare(String(request.body.password || ''), admin.password_hash);
      if (!valid) return response.status(401).json({ ok: false, error: 'Username atau password salah.' });
      request.session.regenerate((regenerateError) => {
        if (regenerateError) return next(regenerateError);
        request.session.adminId = admin.id;
        request.session.adminUsername = admin.username;
        response.json({ ok: true, admin: { id: admin.id, username: admin.username } });
      });
    } catch (error) { next(error); }
  });

  router.post('/logout', (request, response, next) => {
    request.session.destroy((error) => {
      if (error) return next(error);
      response.clearCookie('medan_simpang_admin');
      response.json({ ok: true });
    });
  });

  router.get('/quizzes', requireAdmin, async (_request, response, next) => {
    try { response.json({ ok: true, quizzes: await database.listQuizzes() }); }
    catch (error) { next(error); }
  });

  router.post('/quizzes', requireAdmin, async (request, response, next) => {
    try {
      const validated = validateQuiz(request.body);
      if (validated.error) return response.status(400).json({ ok: false, error: validated.error });
      const quiz = await database.createQuiz({ ...validated.value, createdBy: request.session.adminId });
      response.status(201).json({ ok: true, quiz });
    } catch (error) { next(error); }
  });

  router.get('/quizzes/:id', requireAdmin, async (request, response, next) => {
    try {
      const quiz = await database.getQuiz(request.params.id);
      if (!quiz) return response.status(404).json({ ok: false, error: 'Quiz tidak ditemukan.' });
      response.json({ ok: true, quiz });
    } catch (error) { next(error); }
  });

  router.put('/quizzes/:id', requireAdmin, async (request, response, next) => {
    try {
      const validated = validateQuiz(request.body);
      if (validated.error) return response.status(400).json({ ok: false, error: validated.error });
      const quiz = await database.updateQuiz(request.params.id, validated.value);
      if (!quiz) return response.status(404).json({ ok: false, error: 'Quiz tidak ditemukan.' });
      response.json({ ok: true, quiz });
    } catch (error) { next(error); }
  });

  router.put('/quizzes/:id/questions', requireAdmin, async (request, response, next) => {
    try {
      const existing = await database.getQuiz(request.params.id);
      if (!existing) return response.status(404).json({ ok: false, error: 'Quiz tidak ditemukan.' });
      const validated = validateQuestions(request.body);
      if (validated.error) return response.status(400).json({ ok: false, error: validated.error });
      const quiz = await database.replaceQuestions(request.params.id, validated.value);
      response.json({ ok: true, quiz });
    } catch (error) { next(error); }
  });

  router.post('/quizzes/:id/questions', requireAdmin, async (request, response, next) => {
    try {
      const existing = await database.getQuiz(request.params.id);
      if (!existing) return response.status(404).json({ ok: false, error: 'Quiz tidak ditemukan.' });
      const validated = validateQuestion(request.body);
      if (validated.error) return response.status(400).json({ ok: false, error: validated.error });
      const question = await database.createQuestion(request.params.id, validated.value);
      response.status(201).json({ ok: true, question });
    } catch (error) { next(error); }
  });

  router.put('/quizzes/:id/questions/:questionId', requireAdmin, async (request, response, next) => {
    try {
      const validated = validateQuestion(request.body);
      if (validated.error) return response.status(400).json({ ok: false, error: validated.error });
      const question = await database.updateQuestion(request.params.id, request.params.questionId, validated.value);
      if (!question) return response.status(404).json({ ok: false, error: 'Pertanyaan tidak ditemukan.' });
      response.json({ ok: true, question });
    } catch (error) { next(error); }
  });

  router.delete('/quizzes/:id/questions/:questionId', requireAdmin, async (request, response, next) => {
    try {
      const deleted = await database.deleteQuestion(request.params.id, request.params.questionId);
      if (!deleted) return response.status(404).json({ ok: false, error: 'Pertanyaan tidak ditemukan.' });
      response.json({ ok: true });
    } catch (error) { next(error); }
  });

  router.delete('/quizzes/:id', requireAdmin, async (request, response, next) => {
    try {
      const archived = await database.archiveQuiz(request.params.id);
      if (!archived) return response.status(404).json({ ok: false, error: 'Quiz tidak ditemukan.' });
      response.json({ ok: true });
    } catch (error) { next(error); }
  });

  router.get('/results', requireAdmin, async (_request, response, next) => {
    try { response.json({ ok: true, sessions: await database.listGameResults() }); }
    catch (error) { next(error); }
  });

  router.get('/results/:id', requireAdmin, async (request, response, next) => {
    try {
      const result = await database.getGameResult(request.params.id);
      if (!result) return response.status(404).json({ ok: false, error: 'Hasil game tidak ditemukan.' });
      response.json({ ok: true, result });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { createAdminRouter, validateQuiz, validateQuestion, validateQuestions };
