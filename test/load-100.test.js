const assert = require('node:assert/strict');
const test = require('node:test');
const { io: createClient } = require('socket.io-client');
const { createQuizServer, QUESTION_BANK } = require('../server');

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

test('100 peserta menerima seluruh ronde dan masuk leaderboard akhir', { timeout: 30_000 }, async (t) => {
  const participantTotal = 100;
  const quiz = createQuizServer({ questionDurationMs: 180, revealDurationMs: 45 });
  await quiz.ready;
  await new Promise((resolve) => quiz.httpServer.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${quiz.httpServer.address().port}`;
  const host = createClient(url, { transports: ['websocket'], forceNew: true });
  const players = Array.from({ length: participantTotal }, () => createClient(url, { transports: ['websocket'], forceNew: true }));
  t.after(async () => {
    host.disconnect();
    players.forEach((player) => player.disconnect());
    await quiz.close();
  });

  await Promise.all([once(host, 'connect'), ...players.map((player) => once(player, 'connect'))]);
  const created = await emitAck(host, 'host:create', { hostName: 'Host Load Test' });
  assert.equal(created.ok, true);

  const joined = await Promise.all(players.map((player, index) => emitAck(player, 'player:join', {
    code: created.code,
    name: `Peserta ${String(index + 1).padStart(3, '0')}`,
    className: `VIII-${String.fromCharCode(65 + Math.floor(index / 25))}`
  })));
  assert.equal(joined.filter((result) => result.ok).length, participantTotal);

  const counters = players.map(() => ({ questions: 0, reveals: 0, answers: 0 }));
  const finishedPlayers = players.map((player) => once(player, 'room:finished'));
  players.forEach((player, playerIndex) => {
    player.on('room:question', (payload) => {
      counters[playerIndex].questions += 1;
      const source = QUESTION_BANK.find((question) => question.id === payload.question.id);
      const answerIndex = payload.question.options.indexOf(source.correct);
      player.emit('player:answer', { code: created.code, questionIndex: payload.index, answerIndex }, (result) => {
        if (result?.ok) counters[playerIndex].answers += 1;
      });
    });
    player.on('room:reveal', () => { counters[playerIndex].reveals += 1; });
  });

  const hostFinished = once(host, 'room:finished');
  const started = await emitAck(host, 'host:start', { code: created.code });
  assert.equal(started.ok, true);
  const [result] = await Promise.all([hostFinished, ...finishedPlayers]);

  assert.equal(result.leaderboard.length, participantTotal);
  assert.equal(result.totalQuestions, 15);
  assert.equal(new Set(result.leaderboard.map((entry) => entry.id)).size, participantTotal);
  counters.forEach((counter) => {
    assert.equal(counter.questions, 15);
    assert.equal(counter.reveals, 15);
    assert.equal(counter.answers, 15);
  });
});

test('90 perangkat campuran websocket dan polling dapat menjawab seluruh soal', { timeout: 45_000 }, async (t) => {
  const participantTotal = 90;
  const quiz = createQuizServer({ questionDurationMs: 420, revealDurationMs: 80 });
  await quiz.ready;
  await new Promise((resolve) => quiz.httpServer.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${quiz.httpServer.address().port}`;
  const host = createClient(url, { transports: ['websocket'], forceNew: true });
  const players = Array.from({ length: participantTotal }, (_, index) => createClient(url, {
    transports: index % 3 === 0 ? ['polling'] : ['websocket'],
    forceNew: true,
    reconnection: true
  }));

  t.after(async () => {
    host.disconnect();
    players.forEach((player) => player.disconnect());
    await quiz.close();
  });

  await Promise.all([once(host, 'connect'), ...players.map((player) => once(player, 'connect'))]);
  const created = await emitAck(host, 'host:create', { hostName: 'Host Uji 90 Perangkat' });
  assert.equal(created.ok, true);

  const joined = await Promise.all(players.map((player, index) => emitAck(player, 'player:join', {
    code: created.code,
    name: `Mobile ${String(index + 1).padStart(2, '0')}`,
    className: `Kelas-${(index % 6) + 1}`
  })));
  assert.equal(joined.filter((result) => result.ok).length, participantTotal);

  const answers = Array.from({ length: participantTotal }, () => 0);
  const questions = Array.from({ length: participantTotal }, () => 0);
  const finished = players.map((player) => once(player, 'room:finished'));
  players.forEach((player, playerIndex) => {
    player.on('room:question', (payload) => {
      questions[playerIndex] += 1;
      const source = QUESTION_BANK.find((question) => question.id === payload.question.id);
      const answerIndex = payload.question.options.indexOf(source.correct);
      const mobileTapDelayMs = 25 + ((playerIndex % 8) * 18);
      setTimeout(() => {
        player.emit('player:answer', { code: created.code, questionIndex: payload.index, answerIndex }, (result) => {
          if (result?.ok) answers[playerIndex] += 1;
        });
      }, mobileTapDelayMs);
    });
  });

  const hostFinished = once(host, 'room:finished');
  const started = await emitAck(host, 'host:start', { code: created.code });
  assert.equal(started.ok, true);
  const [result] = await Promise.all([hostFinished, ...finished]);

  assert.equal(result.leaderboard.length, participantTotal);
  assert.equal(result.totalQuestions, 15);
  questions.forEach((count) => assert.equal(count, 15));
  answers.forEach((count) => assert.equal(count, 15));
});
