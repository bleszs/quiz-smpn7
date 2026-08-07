const socket = io({ reconnection: true, reconnectionAttempts: Infinity, timeout: 8000 });

const state = {
  role: null,
  roomCode: '',
  participantId: '',
  player: null,
  currentQuestion: null,
  selectedIndex: null,
  answerResult: null,
  timerFrame: null,
  leaderboard: []
};

const $ = (id) => document.getElementById(id);
const screens = ['homeScreen', 'hostLobbyScreen', 'playerLobbyScreen', 'quizScreen', 'resultScreen', 'errorScreen'];
const letters = ['A', 'B', 'C', 'D'];

function showScreen(id) {
  screens.forEach((screenId) => $(screenId).classList.toggle('hidden', screenId !== id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setConnection(status, label) {
  $('connectionStatus').dataset.state = status;
  $('connectionStatus').lastChild.textContent = ` ${label}`;
}

function setRoom(code) {
  state.roomCode = code || '';
  $('roomChip').textContent = code ? `ROOM ${code}` : '';
  $('roomChip').classList.toggle('hidden', !code);
}

function setBusy(button, busy, busyText) {
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.label;
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.remove('hidden');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => $('toast').classList.add('hidden'), 2400);
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function saveSession(session) {
  sessionStorage.setItem('misi-simpang-session', JSON.stringify(session));
}

function loadSession() {
  try { return JSON.parse(sessionStorage.getItem('misi-simpang-session') || 'null'); }
  catch (_) { return null; }
}

function clearSession() {
  sessionStorage.removeItem('misi-simpang-session');
}

function normalizeCode(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function showForm(type) {
  $('roleChooser').classList.add('hidden');
  $('joinForm').classList.toggle('hidden', type !== 'join');
  $('hostForm').classList.toggle('hidden', type !== 'host');
  window.setTimeout(() => $(type === 'join' ? 'roomCodeInput' : 'hostNameInput').focus(), 0);
}

function showChooser() {
  $('roleChooser').classList.remove('hidden');
  $('joinForm').classList.add('hidden');
  $('hostForm').classList.add('hidden');
  $('joinError').classList.add('hidden');
  $('hostError').classList.add('hidden');
}

function showFormError(id, message) {
  $(id).textContent = message;
  $(id).classList.remove('hidden');
}

function renderHostLobby(snapshot) {
  setRoom(snapshot.code);
  $('hostRoomCode').textContent = snapshot.code;
  const joinUrl = new URL(window.location.href);
  joinUrl.search = '';
  joinUrl.searchParams.set('room', snapshot.code);
  $('joinUrl').textContent = joinUrl.toString();
  renderParticipants(snapshot.participants || []);
  const count = snapshot.participantCount || 0;
  $('participantCount').textContent = `${count} peserta`;
  $('startQuizButton').disabled = count < 1;
  $('startHint').textContent = count < 1 ? 'Minimal 1 peserta untuk memulai.' : `${count} peserta siap bermain.`;
  showScreen('hostLobbyScreen');
}

function renderPlayerLobby(snapshot) {
  setRoom(snapshot.code);
  $('playerRoomCode').textContent = snapshot.code;
  if (state.player) $('playerIdentity').textContent = `${state.player.name} · ${state.player.className}`;
  showScreen('playerLobbyScreen');
}

function renderParticipants(participants) {
  $('participantEmpty').classList.toggle('hidden', participants.length > 0);
  $('participantList').replaceChildren(...participants.map((participant) => {
    const item = document.createElement('li');
    item.className = 'participant-item';
    item.dataset.connected = String(participant.connected);
    item.dataset.answered = String(Boolean(participant.answered));
    const avatar = document.createElement('span');
    avatar.className = 'participant-avatar';
    avatar.textContent = initials(participant.name);
    const label = document.createElement('span');
    label.textContent = participant.name;
    const className = document.createElement('small');
    className.textContent = participant.connected ? participant.className : 'terputus';
    item.append(avatar, label, className);
    return item;
  }));
}

function renderQuestion(payload) {
  state.currentQuestion = payload;
  state.selectedIndex = Number.isInteger(payload.answerIndex) ? payload.answerIndex : null;
  state.answerResult = payload.answerResult || null;
  setRoom(state.roomCode);
  $('questionPosition').textContent = `Soal ${payload.index + 1}/${payload.total}`;
  $('quizRoomLabel').textContent = `Room ${state.roomCode}`;
  $('questionCategory').textContent = payload.question.category;
  $('questionText').textContent = payload.question.question;
  $('questionImage').src = payload.question.image;
  $('questionImage').alt = payload.question.alt;
  $('questionAlt').textContent = payload.question.alt;
  $('answerStatus').className = 'answer-status hidden';
  $('hostProgress').classList.toggle('hidden', state.role !== 'host');
  $('playerScoreWrap').classList.toggle('hidden', state.role === 'host');

  $('answerList').replaceChildren(...payload.question.options.map((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer-button';
    button.dataset.answerIndex = String(index);
    button.dataset.selected = String(index === state.selectedIndex);
    button.disabled = state.role === 'host' || state.selectedIndex !== null;
    const letter = document.createElement('span');
    letter.className = 'answer-letter';
    letter.textContent = letters[index];
    const text = document.createElement('span');
    text.textContent = option;
    const icon = document.createElement('span');
    icon.className = 'answer-result-icon';
    button.append(letter, text, icon);
    return button;
  }));

  if (state.role === 'host') {
    $('answerProgressText').textContent = `0 dari ${payload.participantCount || 0} sudah menjawab`;
    $('answerProgressBar').style.transform = 'scaleX(0)';
  } else if (state.selectedIndex !== null) {
    showAnswerPending();
  }
  showScreen('quizScreen');
  startTimer(payload.endsAt, payload.durationMs);
}

function startTimer(endsAt, durationMs) {
  cancelAnimationFrame(state.timerFrame);
  function update() {
    const remaining = Math.max(0, endsAt - Date.now());
    const seconds = Math.max(0, Math.ceil(remaining / 1000));
    const ratio = Math.max(0, Math.min(1, remaining / durationMs));
    $('timerNumber').textContent = String(seconds);
    $('timerBar').style.transform = `scaleX(${ratio})`;
    const urgent = remaining > 0 && remaining <= 3000;
    $('timerNumber').parentElement.dataset.urgent = String(urgent);
    $('timerBar').dataset.urgent = String(urgent);
    if (remaining > 0) {
      state.timerFrame = requestAnimationFrame(update);
    } else {
      document.querySelectorAll('.answer-button').forEach((button) => { button.disabled = true; });
      if (state.role === 'player' && state.selectedIndex === null) {
        $('answerStatus').className = 'answer-status';
        $('answerStatus').innerHTML = '<strong>Waktu habis.</strong> Tunggu jawaban yang benar ditampilkan.';
      }
    }
  }
  update();
}

function showAnswerPending() {
  $('answerStatus').className = 'answer-status';
  $('answerStatus').innerHTML = '<strong>Jawaban terkirim.</strong> Menunggu waktu soal selesai…';
}

function submitAnswer(answerIndex) {
  if (!state.currentQuestion || state.selectedIndex !== null) return;
  state.selectedIndex = answerIndex;
  document.querySelectorAll('.answer-button').forEach((button) => {
    button.disabled = true;
    button.dataset.selected = String(Number(button.dataset.answerIndex) === answerIndex);
  });
  showAnswerPending();
  socket.emit('player:answer', { code: state.roomCode, questionIndex: state.currentQuestion.index, answerIndex }, (response) => {
    if (!response?.ok) {
      $('answerStatus').className = 'answer-status';
      $('answerStatus').dataset.tone = 'wrong';
      $('answerStatus').innerHTML = `<strong>Jawaban tidak diterima.</strong>${response?.error || 'Coba periksa koneksi.'}`;
      return;
    }
    state.answerResult = response;
    $('liveScore').textContent = response.score.toLocaleString('id-ID');
  });
}

function revealAnswer(payload) {
  cancelAnimationFrame(state.timerFrame);
  $('timerNumber').textContent = '0';
  $('timerBar').style.transform = 'scaleX(0)';
  document.querySelectorAll('.answer-button').forEach((button) => {
    const index = Number(button.dataset.answerIndex);
    button.disabled = true;
    button.dataset.correct = String(index === payload.correctIndex);
    button.dataset.wrong = String(index === state.selectedIndex && index !== payload.correctIndex);
    button.dataset.dim = String(index !== payload.correctIndex && index !== state.selectedIndex);
    const icon = button.querySelector('.answer-result-icon');
    if (index === payload.correctIndex) icon.textContent = '✓';
    if (index === state.selectedIndex && index !== payload.correctIndex) icon.textContent = '×';
  });

  const status = $('answerStatus');
  status.classList.remove('hidden');
  if (state.role === 'host') {
    status.dataset.tone = 'correct';
    status.innerHTML = `<strong>Jawaban: ${escapeHtml(payload.correctAnswer)}</strong>${escapeHtml(payload.explanation)}`;
  } else if (state.answerResult?.isCorrect) {
    status.dataset.tone = 'correct';
    status.innerHTML = `<strong>Benar! +${state.answerResult.award.toLocaleString('id-ID')} poin</strong>${escapeHtml(payload.explanation)}`;
  } else {
    status.dataset.tone = 'wrong';
    const lead = state.selectedIndex === null ? `Waktu habis. Jawabannya ${payload.correctAnswer}.` : `Belum tepat. Jawabannya ${payload.correctAnswer}.`;
    status.innerHTML = `<strong>${escapeHtml(lead)}</strong>${escapeHtml(payload.explanation)}`;
  }
  state.leaderboard = payload.leaderboard;
}

function renderResults(payload) {
  cancelAnimationFrame(state.timerFrame);
  state.leaderboard = payload.leaderboard || [];
  setRoom(payload.code);
  $('resultRoomCode').textContent = payload.code;
  const self = state.leaderboard.find((entry) => entry.id === state.participantId);
  $('resultSummary').textContent = state.role === 'host'
    ? `${state.leaderboard.length} peserta telah menyelesaikan ${payload.totalQuestions} soal.`
    : self ? `Kamu meraih peringkat ${self.rank} dari ${state.leaderboard.length} peserta dengan ${self.score.toLocaleString('id-ID')} poin.` : 'Seluruh jawaban sudah dihitung.';
  renderPodium(state.leaderboard.slice(0, 3));
  renderLeaderboard(state.leaderboard);
  $('playAgainButton').classList.toggle('hidden', state.role !== 'host');
  showScreen('resultScreen');
}

function renderPodium(topPlayers) {
  const displayOrder = topPlayers.length >= 3 ? [topPlayers[1], topPlayers[0], topPlayers[2]] : topPlayers;
  $('podium').replaceChildren(...displayOrder.map((player) => {
    const item = document.createElement('div');
    item.className = 'podium-item';
    item.dataset.rank = String(player.rank);
    item.style.setProperty('--podium-height', `${player.rank === 1 ? 230 : player.rank === 2 ? 195 : 170}px`);
    const rank = document.createElement('span');
    rank.className = 'podium-rank';
    rank.textContent = String(player.rank);
    const name = document.createElement('strong');
    name.textContent = player.name;
    const className = document.createElement('small');
    className.textContent = player.className;
    const score = document.createElement('b');
    score.textContent = player.score.toLocaleString('id-ID');
    item.append(rank, name, className, score);
    return item;
  }));
}

function renderLeaderboard(players) {
  $('leaderboardList').replaceChildren(...players.map((player) => {
    const item = document.createElement('li');
    item.className = 'leaderboard-row';
    item.dataset.self = String(player.id === state.participantId);
    const position = document.createElement('span');
    position.className = 'leaderboard-position';
    position.textContent = `#${player.rank}`;
    const person = document.createElement('span');
    person.className = 'leaderboard-person';
    const name = document.createElement('strong');
    name.textContent = player.name + (player.id === state.participantId ? ' (kamu)' : '');
    const className = document.createElement('small');
    className.textContent = player.className;
    person.append(name, className);
    const correct = document.createElement('span');
    correct.className = 'leaderboard-stat';
    correct.textContent = `${player.correctCount}/10`;
    const score = document.createElement('span');
    score.className = 'leaderboard-score';
    score.textContent = player.score.toLocaleString('id-ID');
    item.append(position, person, correct, score);
    return item;
  }));
}

function escapeHtml(value) {
  const node = document.createElement('span');
  node.textContent = String(value);
  return node.innerHTML;
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast(successMessage);
  } catch (_) {
    toast('Tidak dapat menyalin otomatis.');
  }
}

function resumeSession() {
  const session = loadSession();
  if (!session) return;
  socket.emit('session:resume', session, (response) => {
    if (!response?.ok) {
      clearSession();
      setRoom('');
      toast(response?.error || 'Sesi lama sudah berakhir.');
      showScreen('homeScreen');
      return;
    }
    state.role = response.role;
    state.roomCode = session.code;
    state.participantId = session.participantId || '';
    state.player = response.player || state.player;
    if (response.snapshot.status === 'lobby') {
      if (state.role === 'host') renderHostLobby(response.snapshot);
      else renderPlayerLobby(response.snapshot);
    } else if (response.snapshot.status === 'reveal') {
      toast('Tersambung kembali. Menunggu soal berikutnya…');
    }
  });
}

socket.on('connect', () => {
  setConnection('online', 'Terhubung');
  resumeSession();
});
socket.on('disconnect', () => setConnection('offline', 'Terputus — menyambungkan ulang'));
socket.on('connect_error', () => setConnection('offline', 'Server tidak tersedia'));

socket.on('room:lobby', (snapshot) => {
  if (!state.role || snapshot.code !== state.roomCode) return;
  if (state.role === 'host') renderHostLobby(snapshot);
  else renderPlayerLobby(snapshot);
});

socket.on('room:question', (payload) => {
  if (!state.role) return;
  if (state.role === 'host') payload.participantCount = Number($('participantCount').textContent.split(' ')[0]) || 0;
  renderQuestion(payload);
});

socket.on('room:progress', (payload) => {
  if (state.role !== 'host') return;
  const ratio = payload.participantCount ? payload.answeredCount / payload.participantCount : 0;
  $('answerProgressText').textContent = `${payload.answeredCount} dari ${payload.participantCount} sudah menjawab`;
  $('answerProgressBar').style.transform = `scaleX(${ratio})`;
});

socket.on('room:reveal', revealAnswer);
socket.on('room:finished', renderResults);

$('showJoinButton').addEventListener('click', () => showForm('join'));
$('showHostButton').addEventListener('click', () => showForm('host'));
document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', showChooser));
$('roomCodeInput').addEventListener('input', (event) => { event.target.value = normalizeCode(event.target.value); });

$('joinForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const button = event.submitter;
  const payload = {
    code: normalizeCode($('roomCodeInput').value),
    name: $('playerNameInput').value.trim(),
    className: $('playerClassInput').value.trim()
  };
  if (payload.code.length !== 6 || payload.name.length < 2 || !payload.className) {
    showFormError('joinError', 'Isi kode room, nama, dan kelas dengan lengkap.');
    return;
  }
  $('joinError').classList.add('hidden');
  setBusy(button, true, 'Sedang bergabung…');
  socket.emit('player:join', payload, (response) => {
    setBusy(button, false);
    if (!response?.ok) return showFormError('joinError', response?.error || 'Tidak dapat bergabung ke room.');
    state.role = 'player';
    state.roomCode = response.code;
    state.participantId = response.participantId;
    state.player = { name: payload.name, className: payload.className };
    saveSession({ role: 'player', code: response.code, participantId: response.participantId, token: response.playerToken });
    renderPlayerLobby(response.snapshot);
  });
});

$('hostForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const button = event.submitter;
  const hostName = $('hostNameInput').value.trim();
  if (hostName.length < 2) return showFormError('hostError', 'Nama host minimal 2 karakter.');
  $('hostError').classList.add('hidden');
  setBusy(button, true, 'Membuat room…');
  socket.emit('host:create', { hostName }, (response) => {
    setBusy(button, false);
    if (!response?.ok) return showFormError('hostError', response?.error || 'Tidak dapat membuat room.');
    state.role = 'host';
    state.roomCode = response.code;
    saveSession({ role: 'host', code: response.code, token: response.hostToken });
    renderHostLobby(response.snapshot);
  });
});

$('startQuizButton').addEventListener('click', () => {
  const button = $('startQuizButton');
  setBusy(button, true, 'Memulai…');
  socket.emit('host:start', { code: state.roomCode }, (response) => {
    setBusy(button, false);
    if (!response?.ok) toast(response?.error || 'Kuis tidak dapat dimulai.');
  });
});

$('answerList').addEventListener('click', (event) => {
  const button = event.target.closest('[data-answer-index]');
  if (button && state.role === 'player') submitAnswer(Number(button.dataset.answerIndex));
});

$('copyRoomCode').addEventListener('click', () => copyText(state.roomCode, 'Kode room berhasil disalin.'));
$('copyJoinLink').addEventListener('click', () => copyText($('joinUrl').textContent, 'Tautan room berhasil disalin.'));
$('shareResultButton').addEventListener('click', () => {
  const lines = [`MISI SIMPANG — LEADERBOARD ROOM ${state.roomCode}`, ...state.leaderboard.map((player) => `${player.rank}. ${player.name} (${player.className}) — ${player.score} poin, ${player.correctCount}/10 benar`)];
  copyText(lines.join('\n'), 'Leaderboard berhasil disalin.');
});

$('playAgainButton').addEventListener('click', () => {
  socket.emit('host:reset', { code: state.roomCode }, (response) => {
    if (!response?.ok) toast(response?.error || 'Room tidak dapat diulang.');
  });
});

function leaveRoom() {
  clearSession();
  window.location.href = window.location.pathname;
}

$('leaveRoomButton').addEventListener('click', leaveRoom);
$('homeButton').addEventListener('click', () => {
  if (!state.role || window.confirm('Keluar dari room dan kembali ke halaman awal?')) leaveRoom();
});
$('retryButton').addEventListener('click', () => window.location.reload());

const roomFromUrl = normalizeCode(new URLSearchParams(window.location.search).get('room') || '');
if (roomFromUrl && !loadSession()) {
  $('roomCodeInput').value = roomFromUrl;
  showForm('join');
}
