const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  timeout: 15000,
  tryAllTransports: true,
  transports: ['websocket', 'polling'],
  closeOnBeforeunload: true
});

const state = {
  role: null,
  roomCode: '',
  participantId: '',
  player: null,
  currentQuestion: null,
  selectedIndex: null,
  answerResult: null,
  timerFrame: null,
  leaderboard: [],
  totalQuestions: 15,
  resuming: false,
  answerSending: false,
  pendingAnswer: null,
  hadDisconnect: false,
  connectionAttempts: 0
};

const $ = (id) => document.getElementById(id);
const screens = ['homeScreen', 'hostLobbyScreen', 'playerLobbyScreen', 'quizScreen', 'roundLeaderboardScreen', 'resultScreen', 'errorScreen'];
const letters = ['A', 'B', 'C', 'D'];

function showScreen(id) {
  screens.forEach((screenId) => $(screenId).classList.toggle('hidden', screenId !== id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setConnection(status, label) {
  $('connectionStatus').dataset.state = status;
  $('connectionStatus').lastChild.textContent = ` ${label}`;
}

function showNetworkBanner(title, message, canRetry = true) {
  $('networkTitle').textContent = title;
  $('networkMessage').textContent = message;
  $('retryConnectionButton').classList.toggle('hidden', !canRetry);
  $('networkBanner').classList.remove('hidden');
}

function hideNetworkBanner() {
  $('networkBanner').classList.add('hidden');
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
  const value = JSON.stringify(session);
  sessionStorage.setItem('misi-simpang-session', value);
  localStorage.setItem('misi-simpang-session', value);
}

function loadSession() {
  try {
    const value = sessionStorage.getItem('misi-simpang-session') || localStorage.getItem('misi-simpang-session');
    return JSON.parse(value || 'null');
  }
  catch (_) { return null; }
}

function clearSession() {
  sessionStorage.removeItem('misi-simpang-session');
  localStorage.removeItem('misi-simpang-session');
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
  $('roomQrCode').src = `/api/rooms/${encodeURIComponent(snapshot.code)}/qr`;
  $('roomQrCode').classList.remove('hidden');
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
  $('playerLobbyCount').textContent = `${snapshot.participantCount || 0} peserta`;
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
  const pending = state.pendingAnswer?.questionIndex === payload.index ? state.pendingAnswer : null;
  state.currentQuestion = payload;
  state.selectedIndex = Number.isInteger(payload.answerIndex) ? payload.answerIndex : pending?.answerIndex ?? null;
  state.answerResult = payload.answerResult || null;
  state.totalQuestions = payload.total || state.totalQuestions;
  if (payload.answerResult) state.pendingAnswer = null;
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
  if (pending && !payload.answerResult && Date.now() < payload.endsAt) sendPendingAnswer();
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
  state.pendingAnswer = { questionIndex: state.currentQuestion.index, answerIndex };
  document.querySelectorAll('.answer-button').forEach((button) => {
    button.disabled = true;
    button.dataset.selected = String(Number(button.dataset.answerIndex) === answerIndex);
  });
  showAnswerPending();
  sendPendingAnswer();
}

function sendPendingAnswer() {
  const pending = state.pendingAnswer;
  if (!pending || state.answerSending || !socket.connected || !state.currentQuestion) return;
  if (pending.questionIndex !== state.currentQuestion.index || Date.now() > state.currentQuestion.endsAt + 150) return;
  state.answerSending = true;
  socket.timeout(5000).emit('player:answer', {
    code: state.roomCode,
    questionIndex: pending.questionIndex,
    answerIndex: pending.answerIndex
  }, (error, response) => {
    state.answerSending = false;
    if (error) {
      if (Date.now() < state.currentQuestion.endsAt) window.setTimeout(sendPendingAnswer, 650);
      return;
    }
    if (!response?.ok) {
      state.pendingAnswer = null;
      $('answerStatus').className = 'answer-status';
      $('answerStatus').dataset.tone = 'wrong';
      $('answerStatus').innerHTML = `<strong>Jawaban tidak diterima.</strong>${response?.error || 'Waktu menjawab sudah habis.'}`;
      return;
    }
    state.pendingAnswer = null;
    state.answerResult = response;
    $('liveScore').textContent = response.score.toLocaleString('id-ID');
  });
}

function revealAnswer(payload) {
  cancelAnimationFrame(state.timerFrame);
  state.pendingAnswer = null;
  state.answerSending = false;
  state.leaderboard = payload.leaderboard || [];
  const playerResult = payload.playerResult || payload.playerResults?.find((entry) => entry.id === state.participantId);
  if (playerResult) {
    state.answerResult = { ...state.answerResult, ...playerResult };
    $('liveScore').textContent = playerResult.score.toLocaleString('id-ID');
  }
  renderRoundLeaderboard(payload, playerResult);
}

function renderRoundLeaderboard(payload, playerResult) {
  const questionNumber = payload.questionIndex + 1;
  $('roundResultLabel').textContent = `Hasil soal ${questionNumber} dari ${state.totalQuestions}`;
  $('roundAnswerSummary').textContent = `Jawaban: ${payload.correctAnswer}. ${payload.explanation}`;
  $('roundNextLabel').textContent = payload.isLast
    ? 'Hasil akhir akan muncul otomatis.'
    : `Soal ${questionNumber + 1} akan muncul otomatis.`;

  const selfResult = $('roundSelfResult');
  if (state.role === 'player') {
    const isCorrect = Boolean(playerResult?.isCorrect);
    const award = playerResult?.award || 0;
    selfResult.className = 'round-self-result';
    selfResult.dataset.tone = isCorrect ? 'correct' : 'wrong';
    selfResult.textContent = isCorrect
      ? `Jawabanmu benar · +${award.toLocaleString('id-ID')} poin`
      : state.selectedIndex === null ? 'Waktu habis · 0 poin' : 'Jawabanmu belum tepat · 0 poin';
  } else {
    selfResult.className = 'round-self-result hidden';
  }

  renderLeaderboardRows($('roundLeaderboardList'), state.leaderboard, false);
  showScreen('roundLeaderboardScreen');
  startNextQuestionTimer(payload.nextAt);
}

function startNextQuestionTimer(nextAt) {
  cancelAnimationFrame(state.timerFrame);
  function update() {
    const remaining = Math.max(0, nextAt - Date.now());
    $('nextQuestionTimer').textContent = String(Math.max(0, Math.ceil(remaining / 1000)));
    if (remaining > 0) state.timerFrame = requestAnimationFrame(update);
  }
  update();
}

function renderResults(payload) {
  cancelAnimationFrame(state.timerFrame);
  state.leaderboard = payload.leaderboard || [];
  state.totalQuestions = payload.totalQuestions || state.totalQuestions;
  setRoom(payload.code);
  $('resultRoomCode').textContent = payload.code;
  const self = state.leaderboard.find((entry) => entry.id === state.participantId);
  $('resultSummary').textContent = state.role === 'host'
    ? `${state.leaderboard.length} peserta telah menyelesaikan ${payload.totalQuestions} soal.`
    : self ? `Kamu meraih peringkat ${self.rank} dari ${state.leaderboard.length} peserta dengan ${self.score.toLocaleString('id-ID')} poin.` : 'Seluruh jawaban sudah dihitung.';
  renderPodium(state.leaderboard.slice(0, 3));
  renderLeaderboardRows($('leaderboardList'), state.leaderboard, true);
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

function renderLeaderboardRows(target, players, showCorrect) {
  target.replaceChildren(...players.map((player) => {
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
    correct.textContent = `${player.correctCount}/${state.totalQuestions}`;
    const score = document.createElement('span');
    score.className = 'leaderboard-score';
    score.textContent = player.score.toLocaleString('id-ID');
    item.append(position, person);
    if (showCorrect) item.append(correct);
    item.append(score);
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

function resumeSession(attempt = 0) {
  const session = loadSession();
  if (!session || state.resuming || !socket.connected) return;
  state.resuming = true;
  socket.timeout(8000).emit('session:resume', session, (error, response) => {
    state.resuming = false;
    if (error) {
      if (socket.connected && attempt < 3) {
        window.setTimeout(() => resumeSession(attempt + 1), 500 * (2 ** attempt));
      } else {
        setConnection('offline', 'Pemulihan tertunda');
        showNetworkBanner('Belum tersambung', 'Tekan coba sekarang. Posisi kuismu masih tersimpan.', true);
      }
      return;
    }
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
    if (response.player) $('liveScore').textContent = response.player.score.toLocaleString('id-ID');
    switch (response.snapshot.status) {
      case 'lobby':
        if (state.role === 'host') renderHostLobby(response.snapshot);
        else renderPlayerLobby(response.snapshot);
        break;
      case 'question':
        renderQuestion(response.currentQuestion);
        break;
      case 'reveal':
        renderQuestion(response.currentQuestion);
        revealAnswer(response.reveal);
        break;
      case 'finished':
        renderResults(response.result);
        break;
      default:
        showScreen('homeScreen');
    }
    setConnection('online', 'Terhubung');
    hideNetworkBanner();
    if (state.hadDisconnect) toast('Koneksi kembali. Posisi kuis berhasil dipulihkan.');
    state.hadDisconnect = false;
  });
}

socket.on('connect', () => {
  state.connectionAttempts = 0;
  if (loadSession()) {
    setConnection('connecting', 'Memulihkan sesi');
    showNetworkBanner('Koneksi kembali', 'Sedang mengembalikan posisi kuismu…', false);
    resumeSession();
  } else {
    setConnection('online', 'Terhubung');
    hideNetworkBanner();
  }
});
socket.on('disconnect', () => {
  state.resuming = false;
  state.answerSending = false;
  state.hadDisconnect = true;
  setConnection('offline', 'Terputus — menyambungkan ulang');
  showNetworkBanner('Koneksi terputus', 'Posisimu aman. Kami sedang menyambungkan ulang otomatis.', true);
});
socket.on('connect_error', () => {
  state.connectionAttempts += 1;
  setConnection('offline', 'Server tidak tersedia');
  const message = navigator.onLine
    ? 'Server belum merespons. Kami tetap mencoba secara otomatis.'
    : 'Periksa Wi-Fi atau data seluler, lalu coba kembali.';
  showNetworkBanner('Belum bisa terhubung', message, state.connectionAttempts > 1);
});

socket.io.on('reconnect_attempt', (attempt) => {
  setConnection('connecting', `Mencoba lagi ${attempt}`);
});

socket.on('room:lobby', (snapshot) => {
  if (!state.role || snapshot.code !== state.roomCode || snapshot.status !== 'lobby') return;
  if (state.role === 'host') renderHostLobby(snapshot);
  else renderPlayerLobby(snapshot);
});

socket.on('room:roster', (payload) => {
  if (state.role !== 'host') return;
  renderParticipants(payload.participants || []);
  $('participantCount').textContent = `${payload.participantCount || 0} peserta`;
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
  const lines = [`MISI SIMPANG — LEADERBOARD ROOM ${state.roomCode}`, ...state.leaderboard.map((player) => `${player.rank}. ${player.name} (${player.className}) — ${player.score} poin, ${player.correctCount}/${state.totalQuestions} benar`)];
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
$('retryConnectionButton').addEventListener('click', () => {
  if (!navigator.onLine) {
    toast('Perangkat masih offline. Aktifkan Wi-Fi atau data seluler.');
    return;
  }
  setConnection('connecting', 'Menghubungkan ulang');
  showNetworkBanner('Menghubungkan ulang', 'Mohon tunggu, posisi kuismu sedang dipulihkan…', false);
  if (socket.connected) resumeSession();
  else socket.connect();
});
$('homeButton').addEventListener('click', () => {
  if (!state.role || window.confirm('Keluar dari room dan kembali ke halaman awal?')) leaveRoom();
});
$('retryButton').addEventListener('click', () => window.location.reload());

window.addEventListener('offline', () => {
  state.hadDisconnect = true;
  setConnection('offline', 'Perangkat offline');
  showNetworkBanner('Internet terputus', 'Aktifkan Wi-Fi atau data seluler. Posisi kuismu tetap tersimpan.', true);
});

window.addEventListener('online', () => {
  setConnection('connecting', 'Internet kembali');
  showNetworkBanner('Internet kembali', 'Sedang menyambungkan ke room…', false);
  if (socket.connected) resumeSession();
  else socket.connect();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !loadSession()) return;
  if (socket.connected) resumeSession();
  else socket.connect();
});

const roomFromUrl = normalizeCode(new URLSearchParams(window.location.search).get('room') || '');
if (roomFromUrl && !loadSession()) {
  $('roomCodeInput').value = roomFromUrl;
  showForm('join');
}
