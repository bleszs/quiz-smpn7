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

test('host dan beberapa peserta menyelesaikan satu room sampai leaderboard akhir', async (t) => {
  const quiz = createQuizServer({ questionDurationMs: 250, revealDurationMs: 35 });
  await new Promise((resolve) => quiz.httpServer.listen(0, '127.0.0.1', resolve));
  const address = quiz.httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;
  const host = createClient(url, { transports: ['websocket'], forceNew: true });
  const player = createClient(url, { transports: ['websocket'], forceNew: true });
  const secondPlayer = createClient(url, { transports: ['websocket'], forceNew: true });
  let resumedPlayer;
  t.after(async () => {
    host.disconnect();
    player.disconnect();
    secondPlayer.disconnect();
    resumedPlayer?.disconnect();
    await quiz.close();
  });

  await Promise.all([once(host, 'connect'), once(player, 'connect'), once(secondPlayer, 'connect')]);
  const created = await emitAck(host, 'host:create', { hostName: 'Kak Bleszs' });
  assert.equal(created.ok, true);
  assert.match(created.code, /^[A-Z2-9]{6}$/);

  const joined = await emitAck(player, 'player:join', { code: created.code, name: 'Siswa Satu', className: 'VIII-A' });
  assert.equal(joined.ok, true);
  assert.equal(joined.snapshot.participantCount, 1);
  const secondJoined = await emitAck(secondPlayer, 'player:join', { code: created.code, name: 'Siswa Dua', className: 'VIII-B' });
  assert.equal(secondJoined.ok, true);
  assert.equal(secondJoined.snapshot.participantCount, 2);

  let questionCount = 0;
  let revealCount = 0;
  player.on('room:question', (payload) => {
    questionCount += 1;
    player.emit('player:answer', { code: created.code, questionIndex: payload.index, answerIndex: 0 }, () => {});
  });
  player.on('room:reveal', () => { revealCount += 1; });

  const hostFinished = once(host, 'room:finished');
  const playerFinished = once(player, 'room:finished');
  const started = await emitAck(host, 'host:start', { code: created.code });
  assert.equal(started.ok, true);

  let unexpectedLobbyEvents = 0;
  host.on('room:lobby', () => { unexpectedLobbyEvents += 1; });
  secondPlayer.disconnect();
  resumedPlayer = createClient(url, { transports: ['websocket'], forceNew: true });
  await once(resumedPlayer, 'connect');
  const resumed = await emitAck(resumedPlayer, 'session:resume', {
    role: 'player',
    code: created.code,
    participantId: secondJoined.participantId,
    token: secondJoined.playerToken
  });
  assert.equal(resumed.ok, true);
  assert.notEqual(resumed.snapshot.status, 'lobby');
  assert.ok(resumed.currentQuestion);

  const secondPlayerFinished = once(resumedPlayer, 'room:finished');
  const [hostResult, playerResult, secondPlayerResult] = await Promise.all([hostFinished, playerFinished, secondPlayerFinished]);

  assert.equal(questionCount, 15);
  assert.equal(revealCount, 15);
  assert.equal(hostResult.leaderboard.length, 2);
  assert.deepEqual(new Set(playerResult.leaderboard.map((entry) => entry.name)), new Set(['Siswa Satu', 'Siswa Dua']));
  assert.equal(playerResult.totalQuestions, 15);
  assert.ok(playerResult.leaderboard[0].score >= 0);
  assert.equal(secondPlayerResult.leaderboard.length, 2);
  assert.equal(unexpectedLobbyEvents, 0);

  resumedPlayer.disconnect();
  resumedPlayer = createClient(url, { transports: ['websocket'], forceNew: true });
  await once(resumedPlayer, 'connect');
  const resumedAfterFinish = await emitAck(resumedPlayer, 'session:resume', {
    role: 'player',
    code: created.code,
    participantId: secondJoined.participantId,
    token: secondJoined.playerToken
  });
  assert.equal(resumedAfterFinish.snapshot.status, 'finished');
  assert.equal(resumedAfterFinish.result.leaderboard.length, 2);
  assert.equal(resumedAfterFinish.result.totalQuestions, 15);
});

test('pengiriman ulang jawaban setelah koneksi buruk tidak menggandakan skor', async (t) => {
  const quiz = createQuizServer({ questionDurationMs: 1000, revealDurationMs: 100 });
  await new Promise((resolve) => quiz.httpServer.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${quiz.httpServer.address().port}`;
  const host = createClient(url, { transports: ['websocket'], forceNew: true });
  const player = createClient(url, { transports: ['websocket'], forceNew: true });
  t.after(async () => {
    host.disconnect();
    player.disconnect();
    await quiz.close();
  });

  await Promise.all([once(host, 'connect'), once(player, 'connect')]);
  const created = await emitAck(host, 'host:create', { hostName: 'Host Uji' });
  await emitAck(player, 'player:join', { code: created.code, name: 'Peserta Uji', className: 'VIII-C' });
  const questionPromise = once(player, 'room:question');
  await emitAck(host, 'host:start', { code: created.code });
  const question = await questionPromise;
  const first = await emitAck(player, 'player:answer', { code: created.code, questionIndex: question.index, answerIndex: 0 });
  const duplicate = await emitAck(player, 'player:answer', { code: created.code, questionIndex: question.index, answerIndex: 0 });

  assert.equal(first.ok, true);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.score, first.score);
  assert.equal(duplicate.award, first.award);
});

test('skor mengikuti kecepatan dan soal tetap berjalan penuh sebelum leaderboard 5 detik', async (t) => {
  const questionDurationMs = 600;
  const revealDurationMs = 500;
  const quiz = createQuizServer({ questionDurationMs, revealDurationMs });
  await new Promise((resolve) => quiz.httpServer.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${quiz.httpServer.address().port}`;
  const host = createClient(url, { transports: ['websocket'], forceNew: true });
  const fastPlayer = createClient(url, { transports: ['websocket'], forceNew: true });
  const slowerPlayer = createClient(url, { transports: ['websocket'], forceNew: true });
  t.after(async () => {
    host.disconnect();
    fastPlayer.disconnect();
    slowerPlayer.disconnect();
    await quiz.close();
  });

  await Promise.all([once(host, 'connect'), once(fastPlayer, 'connect'), once(slowerPlayer, 'connect')]);
  const created = await emitAck(host, 'host:create', { hostName: 'Host Waktu' });
  const fastJoined = await emitAck(fastPlayer, 'player:join', { code: created.code, name: 'Peserta Cepat', className: 'VIII-A' });
  const slowJoined = await emitAck(slowerPlayer, 'player:join', { code: created.code, name: 'Peserta Santai', className: 'VIII-B' });
  const fastQuestionPromise = once(fastPlayer, 'room:question');
  const slowQuestionPromise = once(slowerPlayer, 'room:question');
  const revealPromise = once(host, 'room:reveal');
  await emitAck(host, 'host:start', { code: created.code });
  const [fastQuestion, slowQuestion] = await Promise.all([fastQuestionPromise, slowQuestionPromise]);
  const bankQuestion = QUESTION_BANK.find((question) => question.id === fastQuestion.question.id);
  const correctIndex = fastQuestion.question.options.indexOf(bankQuestion.correct);
  const fastResult = await emitAck(fastPlayer, 'player:answer', { code: created.code, questionIndex: fastQuestion.index, answerIndex: correctIndex });
  await new Promise((resolve) => setTimeout(resolve, 280));
  const slowResult = await emitAck(slowerPlayer, 'player:answer', { code: created.code, questionIndex: slowQuestion.index, answerIndex: correctIndex });
  const reveal = await revealPromise;

  assert.equal(fastResult.isCorrect, true);
  assert.equal(slowResult.isCorrect, true);
  assert.ok(fastResult.award > slowResult.award);
  assert.ok(fastResult.award <= 1000 && slowResult.award >= 500);
  assert.equal(fastResult.award % 10, 0);
  assert.ok(Date.now() - fastQuestion.startedAt >= questionDurationMs);
  assert.ok(reveal.nextAt - Date.now() <= revealDurationMs);
  assert.ok(reveal.nextAt - Date.now() > revealDurationMs - 150);
  assert.equal(reveal.playerResults.find((result) => result.id === fastJoined.participantId).award, fastResult.award);
  assert.equal(reveal.playerResults.find((result) => result.id === slowJoined.participantId).award, slowResult.award);
});

test('QR room tersedia dan berformat SVG', async (t) => {
  const quiz = createQuizServer();
  await new Promise((resolve) => quiz.httpServer.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${quiz.httpServer.address().port}`;
  const host = createClient(url, { transports: ['websocket'], forceNew: true });
  t.after(async () => {
    host.disconnect();
    await quiz.close();
  });

  await once(host, 'connect');
  const created = await emitAck(host, 'host:create', { hostName: 'Host QR' });
  const response = await fetch(`${url}/api/rooms/${created.code}/qr`);
  const svg = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(svg, /<svg/);
});
