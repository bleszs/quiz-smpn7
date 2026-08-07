const assert = require('node:assert/strict');
const test = require('node:test');
const { io: createClient } = require('socket.io-client');
const { createQuizServer } = require('../server');

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

test('host dan beberapa peserta menyelesaikan satu room sampai leaderboard akhir', async (t) => {
  const quiz = createQuizServer({ questionDurationMs: 75, revealDurationMs: 30 });
  await new Promise((resolve) => quiz.httpServer.listen(0, '127.0.0.1', resolve));
  const address = quiz.httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;
  const host = createClient(url, { transports: ['websocket'], forceNew: true });
  const player = createClient(url, { transports: ['websocket'], forceNew: true });
  const secondPlayer = createClient(url, { transports: ['websocket'], forceNew: true });
  t.after(async () => {
    host.disconnect();
    player.disconnect();
    secondPlayer.disconnect();
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
  player.on('room:question', (payload) => {
    questionCount += 1;
    player.emit('player:answer', { code: created.code, questionIndex: payload.index, answerIndex: 0 }, () => {});
  });

  const hostFinished = once(host, 'room:finished');
  const playerFinished = once(player, 'room:finished');
  const secondPlayerFinished = once(secondPlayer, 'room:finished');
  const started = await emitAck(host, 'host:start', { code: created.code });
  assert.equal(started.ok, true);
  const [hostResult, playerResult, secondPlayerResult] = await Promise.all([hostFinished, playerFinished, secondPlayerFinished]);

  assert.equal(questionCount, 10);
  assert.equal(hostResult.leaderboard.length, 2);
  assert.deepEqual(new Set(playerResult.leaderboard.map((entry) => entry.name)), new Set(['Siswa Satu', 'Siswa Dua']));
  assert.equal(playerResult.totalQuestions, 10);
  assert.ok(playerResult.leaderboard[0].score >= 0);
  assert.equal(secondPlayerResult.leaderboard.length, 2);
});
