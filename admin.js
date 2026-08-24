const adminSocket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  tryAllTransports: true,
  transports: ['websocket', 'polling'],
  timeout: 15000
});

const adminState = {
  quizzes: [],
  editingQuiz: null,
  questions: [],
  roomCode: '',
  hostToken: '',
  currentQuestion: null,
  participantCount: 0,
  totalQuestions: 0,
  timerFrame: null,
  leaderboard: []
};

const $ = (id) => document.getElementById(id);
const adminViews = ['adminLoading', 'adminLogin', 'adminSetup', 'adminDashboard', 'hostLobby', 'adminQuizScreen', 'adminRoundScreen', 'adminResultScreen'];

function showAdminScreen(id) {
  adminViews.forEach((view) => $(view).classList.toggle('hidden', view !== id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDashboardView(id) {
  ['quizListView', 'quizEditorView', 'resultsView'].forEach((view) => $(view).classList.toggle('hidden', view !== id));
  const content = document.querySelector('.admin-content');
  if (content) content.scrollTo({ top: 0, behavior: 'auto' });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function setAdminBusy(button, busy, label = 'Memproses…') {
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.label;
}

function adminToast(message) {
  $('adminToast').textContent = message;
  $('adminToast').classList.remove('hidden');
  clearTimeout(adminToast.timer);
  adminToast.timer = setTimeout(() => $('adminToast').classList.add('hidden'), 2600);
}

function adminError(id, message = '') {
  $(id).textContent = message;
  $(id).classList.toggle('hidden', !message);
}

async function api(path, options = {}) {
  const response = await fetch(`/api/admin${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({ ok: false, error: 'Respons server tidak valid.' }));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function saveHostSession(value) {
  if (value) localStorage.setItem('medan-simpang-admin-game', JSON.stringify(value));
  else localStorage.removeItem('medan-simpang-admin-game');
}

function loadHostSession() {
  try { return JSON.parse(localStorage.getItem('medan-simpang-admin-game') || 'null'); }
  catch (_) { return null; }
}

async function bootstrapAdmin() {
  try {
    const session = await api('/session');
    if (session.setupRequired) {
      showAdminScreen('adminSetup');
      return;
    }
    if (!session.authenticated) {
      showAdminScreen('adminLogin');
      return;
    }
    $('logoutButton').classList.remove('hidden');
    const game = loadHostSession();
    if (game && adminSocket.connected) resumeHostGame(game);
    else await openDashboard();
  } catch (error) {
    $('adminLoading').querySelector('h1').textContent = 'Admin belum tersedia';
    const paragraph = document.createElement('p');
    paragraph.className = 'lead';
    paragraph.textContent = error.message;
    $('adminLoading').append(paragraph);
  }
}

async function openDashboard() {
  showAdminScreen('adminDashboard');
  showDashboardView('quizListView');
  await loadQuizzes();
}

function makeButton(label, className, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

async function loadQuizzes() {
  const data = await api('/quizzes');
  adminState.quizzes = data.quizzes || [];
  const totalQuestions = adminState.quizzes.reduce((total, quiz) => total + Number(quiz.question_count || 0), 0);
  $('adminQuizTotal').textContent = String(adminState.quizzes.length);
  $('adminQuestionTotal').textContent = String(totalQuestions);
  $('adminQuizCountLabel').textContent = `${adminState.quizzes.length} quiz`;
  const list = $('quizList');
  if (!adminState.quizzes.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-empty';
    empty.innerHTML = '<strong>Belum ada quiz.</strong><p>Buat quiz pertama, tambahkan pertanyaan, lalu publish agar dapat dimainkan.</p>';
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...adminState.quizzes.map((quiz) => {
    const item = document.createElement('article');
    item.className = 'quiz-admin-row';
    const info = document.createElement('div');
    info.className = 'quiz-admin-info';
    const eyebrow = document.createElement('div');
    eyebrow.className = 'quiz-admin-eyebrow';
    const questionCount = document.createElement('span');
    questionCount.className = 'quiz-question-count';
    questionCount.textContent = `${quiz.question_count} soal`;
    eyebrow.append(questionCount);
    const title = document.createElement('h3');
    title.textContent = quiz.title;
    const meta = document.createElement('p');
    meta.textContent = quiz.description || 'Quiz siap diedit, dilengkapi, atau dimainkan bersama peserta.';
    info.append(eyebrow, title, meta);
    const actions = document.createElement('div');
    actions.className = 'quiz-admin-actions';
    const edit = makeButton('Edit', 'secondary', () => editQuiz(quiz.id));
    const start = makeButton('Mulai game', 'primary', () => createRoom(quiz));
    start.disabled = quiz.status !== 'published' || quiz.question_count < 1;
    const remove = makeButton('Hapus quiz', 'quiz-delete-button', () => archiveQuiz(quiz));
    remove.title = 'Hapus quiz';
    remove.setAttribute('aria-label', `Hapus quiz ${quiz.title}`);
    actions.append(edit, start, remove);
    item.append(info, actions);
    return item;
  }));
}

function blankQuestion() {
  return { id: null, category: '', prompt: '', options: ['', '', '', ''], correctOptionIndex: 0, timeLimitSeconds: 10, basePoints: 1000, explanation: '', imageUrl: '', altText: '', expanded: true };
}

function questionFromApi(question) {
  return {
    id: question.id,
    category: question.category || '',
    prompt: question.question || '',
    options: question.options || ['', '', '', ''],
    correctOptionIndex: question.correctIndex ?? 0,
    timeLimitSeconds: Math.round((question.timeLimitMs || 10_000) / 1000),
    basePoints: question.basePoints ?? 1000,
    explanation: question.explanation || '',
    imageUrl: question.image || '',
    altText: question.alt || '',
    expanded: false
  };
}

function questionBody(question) {
  return {
    category: question.category,
    prompt: question.prompt,
    options: question.options,
    correctOptionIndex: question.correctOptionIndex,
    timeLimitSeconds: question.timeLimitSeconds,
    basePoints: question.basePoints,
    explanation: question.explanation,
    imageUrl: question.imageUrl,
    altText: question.altText
  };
}

async function saveQuestion(question, index, button) {
  if (!adminState.editingQuiz) return adminToast('Simpan informasi quiz terlebih dahulu.');
  setAdminBusy(button, true, 'Menyimpan…');
  try {
    const path = question.id
      ? `/quizzes/${adminState.editingQuiz.id}/questions/${question.id}`
      : `/quizzes/${adminState.editingQuiz.id}/questions`;
    const method = question.id ? 'PUT' : 'POST';
    const data = await api(path, { method, body: JSON.stringify(questionBody(question)) });
    adminState.questions[index] = questionFromApi(data.question);
    renderQuestionEditors();
    await loadQuizzes();
    adminToast(question.id ? 'Perubahan soal disimpan.' : 'Soal baru ditambahkan.');
  } catch (error) {
    adminToast(error.message);
    setAdminBusy(button, false);
  }
}

async function deleteQuestion(question, index) {
  if (!question.id) {
    adminState.questions.splice(index, 1);
    renderQuestionEditors();
    return;
  }
  if (!window.confirm(`Hapus soal ${index + 1}? Tindakan ini tidak dapat dibatalkan.`)) return;
  try {
    await api(`/quizzes/${adminState.editingQuiz.id}/questions/${question.id}`, { method: 'DELETE' });
    adminState.questions.splice(index, 1);
    renderQuestionEditors();
    await loadQuizzes();
    adminToast('Pertanyaan berhasil dihapus.');
  } catch (error) { adminToast(error.message); }
}

function renderQuestionEditors() {
  const list = $('questionEditorList');
  $('editorQuestionCount').textContent = `${adminState.questions.length} soal`;
  if (!adminState.editingQuiz) {
    const message = document.createElement('div');
    message.className = 'admin-empty question-empty';
    message.innerHTML = '<strong>Simpan informasi quiz terlebih dahulu.</strong><p>Setelah quiz dibuat, tombol tambah soal akan aktif dan setiap pertanyaan dapat dikelola sendiri.</p>';
    list.replaceChildren(message);
    $('addQuestionButton').disabled = true;
    return;
  }
  $('addQuestionButton').disabled = adminState.questions.some((question) => !question.id);
  if (!adminState.questions.length) {
    const message = document.createElement('div');
    message.className = 'admin-empty question-empty';
    message.innerHTML = '<strong>Belum ada pertanyaan.</strong><p>Tambahkan soal pertama untuk quiz ini.</p>';
    list.replaceChildren(message);
    return;
  }
  list.replaceChildren(...adminState.questions.map((question, index) => {
    const panel = document.createElement('article');
    panel.className = 'question-editor-item';
    panel.dataset.expanded = String(Boolean(question.expanded));
    panel.innerHTML = `
      <div class="question-editor-title">
        <span class="question-number">${index + 1}</span>
        <div class="question-editor-summary"><strong></strong><small>${question.category || 'Tanpa kategori'} · ${question.timeLimitSeconds} detik · ${question.basePoints} poin</small></div>
        <div class="question-row-actions">
          <button type="button" class="secondary compact-button" data-toggle>${question.expanded ? 'Tutup' : 'Edit'}</button>
          <button type="button" class="text-button danger-text" data-remove>Hapus</button>
        </div>
      </div>
      <div class="question-editor-fields ${question.expanded ? '' : 'hidden'}">
        <div class="quiz-meta-fields">
          <label class="field field-wide"><span>Pertanyaan</span><textarea data-key="prompt" rows="2" maxlength="500"></textarea></label>
          <label class="field"><span>Kategori</span><input data-key="category" maxlength="80" /></label>
          <label class="field"><span>Jawaban benar</span><select data-key="correctOptionIndex"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></label>
          <label class="field"><span>Timer (detik)</span><input data-key="timeLimitSeconds" type="number" min="3" max="120" /></label>
          <label class="field"><span>Poin maksimum</span><input data-key="basePoints" type="number" min="0" max="100000" step="10" /></label>
        </div>
        <div class="option-editor-grid">
          <label class="field"><span>Pilihan A</span><input data-option="0" maxlength="200" /></label>
          <label class="field"><span>Pilihan B</span><input data-option="1" maxlength="200" /></label>
          <label class="field"><span>Pilihan C</span><input data-option="2" maxlength="200" /></label>
          <label class="field"><span>Pilihan D</span><input data-option="3" maxlength="200" /></label>
        </div>
        <div class="quiz-meta-fields">
          <label class="field field-wide"><span>Penjelasan jawaban</span><textarea data-key="explanation" rows="2" maxlength="500"></textarea></label>
          <label class="field"><span>URL/path gambar</span><input data-key="imageUrl" maxlength="500" placeholder="assets/contoh.jpg" /></label>
          <label class="field"><span>Deskripsi gambar</span><input data-key="altText" maxlength="250" /></label>
        </div>
        <div class="question-save-row"><button type="button" class="primary compact-button" data-save>${question.id ? 'Simpan perubahan' : 'Simpan soal baru'}</button></div>
      </div>`;
    panel.querySelector('.question-editor-summary strong').textContent = question.prompt || 'Soal baru belum diisi';
    panel.querySelectorAll('[data-key]').forEach((input) => {
      input.value = question[input.dataset.key];
      input.addEventListener('input', () => { question[input.dataset.key] = input.type === 'number' ? Number(input.value) : input.value; });
    });
    panel.querySelectorAll('[data-option]').forEach((input) => {
      input.value = question.options[Number(input.dataset.option)] || '';
      input.addEventListener('input', () => { question.options[Number(input.dataset.option)] = input.value; });
    });
    panel.querySelector('[data-toggle]').addEventListener('click', () => { question.expanded = !question.expanded; renderQuestionEditors(); });
    panel.querySelector('[data-remove]').addEventListener('click', () => deleteQuestion(question, index));
    panel.querySelector('[data-save]').addEventListener('click', (event) => saveQuestion(question, index, event.currentTarget));
    return panel;
  }));
}

async function editQuiz(id) {
  const data = await api(`/quizzes/${id}`);
  adminState.editingQuiz = data.quiz;
  adminState.questions = data.quiz.questions.map(questionFromApi);
  $('editorTitle').textContent = `Edit ${data.quiz.title}`;
  $('quizTitleInput').value = data.quiz.title;
  $('quizDescriptionInput').value = data.quiz.description;
  $('quizStatusInput').value = data.quiz.status;
  renderQuestionEditors();
  showDashboardView('quizEditorView');
}

function newQuiz() {
  adminState.editingQuiz = null;
  adminState.questions = [];
  $('editorTitle').textContent = 'Buat quiz';
  $('quizTitleInput').value = '';
  $('quizDescriptionInput').value = '';
  $('quizStatusInput').value = 'draft';
  renderQuestionEditors();
  showDashboardView('quizEditorView');
}

async function saveQuiz(event) {
  event.preventDefault();
  const button = event.submitter;
  setAdminBusy(button, true, 'Menyimpan…');
  $('saveState').textContent = '';
  try {
    const body = {
      title: $('quizTitleInput').value,
      description: $('quizDescriptionInput').value,
      status: $('quizStatusInput').value
    };
    const creating = !adminState.editingQuiz;
    const quiz = creating
      ? (await api('/quizzes', { method: 'POST', body: JSON.stringify(body) })).quiz
      : (await api(`/quizzes/${adminState.editingQuiz.id}`, { method: 'PUT', body: JSON.stringify(body) })).quiz;
    adminState.editingQuiz = quiz;
    $('editorTitle').textContent = `Edit ${quiz.title}`;
    $('saveState').textContent = 'Tersimpan';
    adminToast(creating ? 'Quiz dibuat. Sekarang tambahkan pertanyaan.' : 'Informasi quiz disimpan.');
    renderQuestionEditors();
    await loadQuizzes();
  } catch (error) {
    $('saveState').textContent = error.message;
  } finally { setAdminBusy(button, false); }
}

async function archiveQuiz(quiz) {
  if (!window.confirm(`Hapus quiz “${quiz.title}”? Riwayat game tetap tersimpan.`)) return;
  try {
    await api(`/quizzes/${quiz.id}`, { method: 'DELETE' });
    adminToast('Quiz dihapus dari daftar.');
    await loadQuizzes();
  } catch (error) { adminToast(error.message); }
}

function createRoom(quiz) {
  if (!adminSocket.connected) return adminToast('Koneksi realtime belum siap. Coba lagi.');
  adminSocket.timeout(12000).emit('host:create', { hostName: 'Admin Medan Simpang', quizId: quiz.id }, (error, response) => {
    if (error || !response?.ok) return adminToast(response?.error || 'Room tidak dapat dibuat.');
    adminState.roomCode = response.code;
    adminState.hostToken = response.hostToken;
    adminState.totalQuestions = response.snapshot.totalQuestions;
    saveHostSession({ role: 'host', code: response.code, token: response.hostToken });
    renderHostLobby(response.snapshot);
  });
}

function renderParticipants(participants) {
  $('adminParticipantEmpty').classList.toggle('hidden', participants.length > 0);
  $('adminParticipantList').replaceChildren(...participants.map((participant) => {
    const item = document.createElement('li');
    item.className = 'participant-item';
    item.dataset.connected = String(participant.connected);
    const avatar = document.createElement('span');
    avatar.className = 'participant-avatar';
    avatar.textContent = participant.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    const name = document.createElement('span');
    name.textContent = participant.name;
    const className = document.createElement('small');
    className.textContent = participant.connected ? participant.className : 'terputus';
    item.append(avatar, name, className);
    return item;
  }));
}

function renderHostLobby(snapshot) {
  adminState.roomCode = snapshot.code;
  adminState.participantCount = snapshot.participantCount || 0;
  adminState.totalQuestions = snapshot.totalQuestions || adminState.totalQuestions;
  $('adminRoomChip').textContent = `ROOM ${snapshot.code}`;
  $('adminRoomChip').classList.remove('hidden');
  $('adminRoomCode').textContent = snapshot.code;
  $('activeQuizName').textContent = snapshot.quizTitle || 'Room quiz';
  const joinUrl = new URL(snapshot.publicJoinUrl || '/join', window.location.origin);
  joinUrl.searchParams.set('room', snapshot.code);
  $('adminJoinUrl').textContent = joinUrl.toString();
  $('adminQr').src = `/api/rooms/${encodeURIComponent(snapshot.code)}/qr`;
  renderParticipants(snapshot.participants || []);
  $('adminParticipantCount').textContent = `${adminState.participantCount} peserta`;
  $('adminStartButton').disabled = adminState.participantCount < 1;
  $('adminStartHint').textContent = adminState.participantCount < 1 ? 'Minimal 1 peserta untuk memulai.' : `${adminState.participantCount} peserta siap bermain.`;
  showAdminScreen('hostLobby');
}

function startAdminTimer(endsAt, durationMs, numberId, barId) {
  cancelAnimationFrame(adminState.timerFrame);
  function update() {
    const remaining = Math.max(0, endsAt - Date.now());
    $(numberId).textContent = String(Math.max(0, Math.ceil(remaining / 1000)));
    if (barId) $(barId).style.transform = `scaleX(${Math.max(0, Math.min(1, remaining / durationMs))})`;
    if (remaining > 0) adminState.timerFrame = requestAnimationFrame(update);
  }
  update();
}

function renderAdminQuestion(payload) {
  adminState.currentQuestion = payload;
  adminState.totalQuestions = payload.total;
  $('adminQuestionPosition').textContent = `Soal ${payload.index + 1}/${payload.total}`;
  $('adminQuizRoomLabel').textContent = `Room ${adminState.roomCode}`;
  $('adminQuestionCategory').textContent = payload.question.category;
  $('adminQuestionText').textContent = payload.question.question;
  $('adminQuestionImage').src = payload.question.image || '/assets/kampung-silalas.jpg';
  $('adminQuestionImage').alt = payload.question.alt || '';
  $('adminQuestionAlt').textContent = payload.question.alt || '';
  $('adminAnswerList').replaceChildren(...payload.question.options.map((option, index) => {
    const item = document.createElement('div');
    item.className = 'answer-button';
    const letter = document.createElement('span');
    letter.className = 'answer-letter';
    letter.textContent = ['A', 'B', 'C', 'D'][index];
    const text = document.createElement('span');
    text.textContent = option;
    item.append(letter, text);
    return item;
  }));
  $('adminProgressText').textContent = `0 dari ${payload.participantCount || adminState.participantCount} sudah menjawab`;
  $('adminProgressBar').style.transform = 'scaleX(0)';
  showAdminScreen('adminQuizScreen');
  startAdminTimer(payload.endsAt, payload.durationMs, 'adminTimerNumber', 'adminTimerBar');
}

function leaderboardRows(players, totalQuestions, includeCorrect = false) {
  return players.map((player) => {
    const item = document.createElement('li');
    item.className = 'leaderboard-row';
    const rank = document.createElement('span'); rank.className = 'leaderboard-position'; rank.textContent = `#${player.rank}`;
    const person = document.createElement('span'); person.className = 'leaderboard-person';
    const name = document.createElement('strong'); name.textContent = player.name;
    const group = document.createElement('small'); group.textContent = player.className;
    person.append(name, group);
    const correct = document.createElement('span'); correct.className = 'leaderboard-stat'; correct.textContent = `${player.correctCount}/${totalQuestions}`;
    const score = document.createElement('span'); score.className = 'leaderboard-score'; score.textContent = player.score.toLocaleString('id-ID');
    item.append(rank, person); if (includeCorrect) item.append(correct); item.append(score);
    return item;
  });
}

function renderAdminReveal(payload) {
  adminState.leaderboard = payload.leaderboard || [];
  $('adminRoundLabel').textContent = `Hasil soal ${payload.questionIndex + 1} dari ${adminState.totalQuestions}`;
  $('adminRoundSummary').textContent = `Jawaban: ${payload.correctAnswer}. ${payload.explanation}`;
  $('adminRoundList').replaceChildren(...leaderboardRows(adminState.leaderboard, adminState.totalQuestions));
  showAdminScreen('adminRoundScreen');
  startAdminTimer(payload.nextAt, 5000, 'adminNextTimer');
}

function renderAdminResult(payload) {
  cancelAnimationFrame(adminState.timerFrame);
  adminState.leaderboard = payload.leaderboard || [];
  adminState.totalQuestions = payload.totalQuestions;
  $('adminResultCode').textContent = payload.code;
  $('adminResultSummary').textContent = `${adminState.leaderboard.length} peserta menyelesaikan ${payload.totalQuestions} soal.`;
  const top = adminState.leaderboard.slice(0, 3);
  const order = top.length >= 3 ? [top[1], top[0], top[2]] : top;
  $('adminPodium').replaceChildren(...order.map((player) => {
    const item = document.createElement('div'); item.className = 'podium-item'; item.dataset.rank = player.rank; item.style.setProperty('--podium-height', player.rank === 1 ? '230px' : player.rank === 2 ? '195px' : '170px');
    const rank = document.createElement('span'); rank.className = 'podium-rank'; rank.textContent = player.rank;
    const name = document.createElement('strong'); name.textContent = player.name;
    const group = document.createElement('small'); group.textContent = player.className;
    const score = document.createElement('b'); score.textContent = player.score.toLocaleString('id-ID');
    item.append(rank, name, group, score); return item;
  }));
  $('adminLeaderboard').replaceChildren(...leaderboardRows(adminState.leaderboard, payload.totalQuestions, true));
  showAdminScreen('adminResultScreen');
}

async function showStoredResult(sessionId) {
  try {
    const data = await api(`/results/${sessionId}`);
    const result = data.result;
    const detail = $('resultDetail');
    detail.classList.remove('hidden');
    const heading = document.createElement('div');
    heading.className = 'result-detail-heading';
    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = `${result.quiz_title || 'Quiz'} · Room ${result.room_code}`;
    const meta = document.createElement('p');
    meta.textContent = `${result.participants.length} peserta · ${result.status}`;
    copy.append(title, meta);
    const close = makeButton('Tutup detail', 'secondary', () => detail.classList.add('hidden'));
    heading.append(copy, close);
    const table = document.createElement('ol');
    table.className = 'leaderboard-list stored-result-list';
    table.append(...result.participants.map((participant) => {
      const item = document.createElement('li');
      item.className = 'leaderboard-row';
      const rank = document.createElement('span'); rank.className = 'leaderboard-position'; rank.textContent = `#${participant.rank}`;
      const person = document.createElement('span'); person.className = 'leaderboard-person';
      const name = document.createElement('strong'); name.textContent = participant.nickname;
      const className = document.createElement('small'); className.textContent = participant.class_name;
      person.append(name, className);
      const correct = document.createElement('span'); correct.className = 'leaderboard-stat'; correct.textContent = `${participant.correct_count} benar`;
      const score = document.createElement('span'); score.className = 'leaderboard-score'; score.textContent = Number(participant.score).toLocaleString('id-ID');
      item.append(rank, person, correct, score);
      return item;
    }));
    detail.replaceChildren(heading, table);
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { adminToast(error.message); }
}

async function loadStoredResults() {
  const data = await api('/results');
  $('resultDetail').classList.add('hidden');
  const sessions = data.sessions || [];
  if (!sessions.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-empty';
    empty.innerHTML = '<strong>Belum ada riwayat game.</strong><p>Riwayat dan leaderboard akan tampil setelah sebuah permainan selesai.</p>';
    $('resultsList').replaceChildren(empty);
    return;
  }
  $('resultsList').replaceChildren(...sessions.map((session) => {
    const row = document.createElement('div');
    row.className = 'result-admin-row';
    const info = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = session.quiz_title || 'Quiz';
    const meta = document.createElement('span'); meta.textContent = `Room ${session.room_code} · ${session.participant_count} peserta`;
    info.append(title, meta);
    const actions = document.createElement('div');
    const status = document.createElement('b'); status.textContent = session.status;
    const view = makeButton('Lihat hasil', 'secondary', () => showStoredResult(session.id));
    actions.append(status, view);
    row.append(info, actions);
    return row;
  }));
}

function resumeHostGame(game) {
  adminSocket.timeout(10000).emit('session:resume', game, (error, response) => {
    if (error || !response?.ok) {
      saveHostSession(null);
      openDashboard();
      return;
    }
    adminState.roomCode = game.code;
    adminState.hostToken = game.token;
    adminState.totalQuestions = response.snapshot.totalQuestions;
    if (response.snapshot.status === 'lobby') renderHostLobby(response.snapshot);
    else if (response.snapshot.status === 'question') renderAdminQuestion(response.currentQuestion);
    else if (response.snapshot.status === 'reveal') renderAdminReveal(response.reveal);
    else if (response.snapshot.status === 'finished') renderAdminResult(response.result);
  });
}

adminSocket.on('connect', () => {
  $('adminConnection').dataset.state = 'online';
  $('adminConnection').lastChild.textContent = ' Terhubung';
  const game = loadHostSession();
  if (game && !$('adminLoading').classList.contains('hidden')) resumeHostGame(game);
});
adminSocket.on('disconnect', () => {
  $('adminConnection').dataset.state = 'offline';
  $('adminConnection').lastChild.textContent = ' Menyambungkan ulang';
});
adminSocket.on('room:lobby', (snapshot) => { if (snapshot.code === adminState.roomCode) renderHostLobby(snapshot); });
adminSocket.on('room:roster', (payload) => {
  adminState.participantCount = payload.participantCount;
  renderParticipants(payload.participants || []);
  $('adminParticipantCount').textContent = `${payload.participantCount} peserta`;
});
adminSocket.on('room:question', renderAdminQuestion);
adminSocket.on('room:progress', (payload) => {
  $('adminProgressText').textContent = `${payload.answeredCount} dari ${payload.participantCount} sudah menjawab`;
  $('adminProgressBar').style.transform = `scaleX(${payload.participantCount ? payload.answeredCount / payload.participantCount : 0})`;
});
adminSocket.on('room:reveal', renderAdminReveal);
adminSocket.on('room:finished', renderAdminResult);

$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const button = event.submitter; setAdminBusy(button, true, 'Login…'); adminError('loginError');
  try { await api('/login', { method: 'POST', body: JSON.stringify({ username: $('loginUsername').value, password: $('loginPassword').value }) }); adminSocket.disconnect().connect(); $('logoutButton').classList.remove('hidden'); await openDashboard(); }
  catch (error) { adminError('loginError', error.message); } finally { setAdminBusy(button, false); }
});
$('setupForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const button = event.submitter; setAdminBusy(button, true, 'Membuat…'); adminError('setupError');
  try { await api('/setup', { method: 'POST', body: JSON.stringify({ setupToken: $('setupToken').value, username: $('setupUsername').value, password: $('setupPassword').value }) }); adminSocket.disconnect().connect(); $('logoutButton').classList.remove('hidden'); await openDashboard(); }
  catch (error) { adminError('setupError', error.message); } finally { setAdminBusy(button, false); }
});
$('logoutButton').addEventListener('click', async () => { await api('/logout', { method: 'POST' }); saveHostSession(null); window.location.reload(); });
$('newQuizButton').addEventListener('click', newQuiz);
$('backToQuizzes').addEventListener('click', () => showDashboardView('quizListView'));
$('cancelEditorButton').addEventListener('click', async () => { showDashboardView('quizListView'); await loadQuizzes(); });
$('addQuestionButton').addEventListener('click', () => {
  if (!adminState.editingQuiz) return adminToast('Simpan informasi quiz terlebih dahulu.');
  if (adminState.questions.some((question) => !question.id)) return adminToast('Selesaikan soal baru yang sedang dibuat.');
  adminState.questions.forEach((question) => { question.expanded = false; });
  adminState.questions.push(blankQuestion());
  renderQuestionEditors();
  $('questionEditorList').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
$('quizEditorForm').addEventListener('submit', saveQuiz);
document.querySelectorAll('[data-admin-view]').forEach((button) => button.addEventListener('click', async () => {
  document.querySelectorAll('[data-admin-view]').forEach((item) => { item.dataset.active = String(item === button); });
  if (button.dataset.adminView === 'quizzes') { showDashboardView('quizListView'); await loadQuizzes(); }
  else { showDashboardView('resultsView'); await loadStoredResults(); }
}));
$('adminStartButton').addEventListener('click', () => adminSocket.emit('host:start', { code: adminState.roomCode }, (response) => { if (!response?.ok) adminToast(response?.error || 'Quiz tidak dapat dimulai.'); }));
$('adminCopyCode').addEventListener('click', () => navigator.clipboard.writeText(adminState.roomCode).then(() => adminToast('Kode disalin.')));
$('adminCopyLink').addEventListener('click', () => navigator.clipboard.writeText($('adminJoinUrl').textContent).then(() => adminToast('Tautan disalin.')));
$('adminCloseRoomButton').addEventListener('click', openDashboard);
$('adminReturnButton').addEventListener('click', async () => { saveHostSession(null); $('adminRoomChip').classList.add('hidden'); await openDashboard(); });

bootstrapAdmin();
