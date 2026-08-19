const crypto = require('node:crypto');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const helmet = require('helmet');
const QRCode = require('qrcode');
const { Server } = require('socket.io');
const { createDatabase } = require('./src/database');
const { createAdminRouter } = require('./src/admin-routes');

const QUESTION_BANK = [
  { id: 1, category: 'Kawasan Silalas', question: 'Ada berapa walking trails yang ditampilkan di kawasan Silalas?', options: ['3 rute', '4 rute', '5 rute', '6 rute'], correct: '5 rute', explanation: 'Halaman Silalas menampilkan lima rute jalan kaki.', image: 'assets/kampung-silalas.jpg', alt: 'Suasana kawasan Silalas di Medan' },
  { id: 2, category: 'Baca Rute', question: 'Berapa estimasi waktu untuk menempuh Trails 1 Tepian Sungai Deli?', options: ['30 menit', '35 menit', '60 menit', '90 menit'], correct: '60 menit', explanation: 'Estimasi Trails 1 adalah 1,0 jam atau 60 menit.', image: 'assets/deli-riverview.jpg', alt: 'Pemandangan tepian Sungai Deli' },
  { id: 3, category: 'Baca Rute', question: 'Berapa jumlah POI atau lokasi pada Trails 1?', options: ['8 POI', '12 POI', '15 POI', '20 POI'], correct: '15 POI', explanation: 'Pada informasi rute tercantum 15 POI.', image: 'assets/deli-riverview.jpg', alt: 'Salah satu lokasi di Trails 1 Tepian Sungai Deli' },
  { id: 4, category: 'Baca Rute', question: 'Berapa jarak Trails 1 Tepian Sungai Deli?', options: ['0,7 km', '1,2 km', '1,6 km', '2,3 km'], correct: '1,6 km', explanation: 'Jarak Trails 1 yang tercantum adalah 1,6 kilometer.', image: 'assets/deli-riverview.jpg', alt: 'Jalur tepian Sungai Deli' },
  { id: 5, category: 'Baca Rute', question: 'Berapa perkiraan jumlah langkah pada Trails 1?', options: ['1.100 langkah', '1.400 langkah', '2.000 langkah', '2.300 langkah'], correct: '2.300 langkah', explanation: 'Perkiraan perjalanan Trails 1 adalah 2.300 langkah.', image: 'assets/kampung-silalas.jpg', alt: 'Gang yang menjadi bagian dari rute jalan kaki Silalas' },
  { id: 6, category: 'Kategori Lokasi', question: 'Jembatan Kereta Api pada Trails 1 termasuk kategori apa?', options: ['iSee', 'iEat', 'iDrink', 'iSurprise'], correct: 'iSurprise', explanation: 'Jembatan Kereta Api termasuk iSurprise, yaitu kejutan menarik yang sering terlewat.', image: 'assets/jembatan-rel.jpg', alt: 'Jembatan rel kereta api tua di atas Sungai Deli' },
  { id: 7, category: 'Kategori Lokasi', question: 'Manakah tempat kategori iEat pada Trails 1?', options: ['Masjid Al Muflihin', 'Dapur Sedap Wangi', 'Rumah Qohwah', 'Florist'], correct: 'Dapur Sedap Wangi', explanation: 'Dapur Sedap Wangi tercantum sebagai lokasi kategori iEat.', image: 'assets/jajanan-lokal.jpg', alt: 'Makanan lokal yang dapat ditemukan saat menjelajah Silalas' },
  { id: 8, category: 'Kategori Lokasi', question: 'Manakah tempat kategori iDrink pada Trails 1?', options: ['Rumah Qohwah', 'Jl. Kemiri', 'Jembatan Kereta Api', 'Masjid Haji Maraset'], correct: 'Rumah Qohwah', explanation: 'Rumah Qohwah tercantum sebagai lokasi kategori iDrink.', image: 'assets/rumah-qohwah.jpg', alt: 'Rumah Qohwah di kawasan Silalas' },
  { id: 9, category: 'Bandingkan Rute', question: 'Rute mana yang memiliki jarak paling panjang di Silalas?', options: ['Trails 1 Tepian Sungai Deli', 'Trails 2 Lanskap Kampung Melayu', 'Trails 4 Masjid Tua Silalas', 'Trails 5 Kampung & Pemakaman Hijau'], correct: 'Trails 1 Tepian Sungai Deli', explanation: 'Dengan jarak 1,6 km, Trails 1 adalah yang paling panjang.', image: 'assets/deli-riverview.jpg', alt: 'Kawasan tepian sungai pada Trails 1' },
  { id: 10, category: 'Bandingkan Rute', question: 'Rute mana yang memiliki jarak paling pendek di Silalas?', options: ['Trails 1 Tepian Sungai Deli', 'Trails 3 Rumah Tradisional Melayu', 'Trails 4 Masjid Tua Silalas', 'Trails 5 Kampung & Pemakaman Hijau'], correct: 'Trails 4 Masjid Tua Silalas', explanation: 'Trails 4 memiliki jarak 0,702 km, paling pendek dari lima rute.', image: 'assets/masjid-silalas.jpg', alt: 'Masjid bersejarah di kawasan Silalas' },
  { id: 11, category: 'Kenali Rute', question: 'Rute mana yang mengajak peserta menyusuri lanskap Kampung Melayu?', options: ['Trails 1', 'Trails 2', 'Trails 3', 'Trails 5'], correct: 'Trails 2', explanation: 'Trails 2 bertema Lanskap Kampung Melayu.', image: 'assets/kampung-silalas.jpg', alt: 'Lanskap permukiman Kampung Melayu di kawasan Silalas' },
  { id: 12, category: 'Kenali Rute', question: 'Rute mana yang berfokus pada rumah tradisional Melayu?', options: ['Trails 1', 'Trails 2', 'Trails 3', 'Trails 4'], correct: 'Trails 3', explanation: 'Trails 3 bertema Rumah Tradisional Melayu.', image: 'assets/kampung-silalas.jpg', alt: 'Lingkungan rumah tradisional Melayu di kawasan Silalas' },
  { id: 13, category: 'Kenali Rute', question: 'Rute mana yang bertema Masjid Tua Silalas?', options: ['Trails 2', 'Trails 3', 'Trails 4', 'Trails 5'], correct: 'Trails 4', explanation: 'Trails 4 mengajak peserta mengenal Masjid Tua Silalas.', image: 'assets/masjid-silalas.jpg', alt: 'Masjid tua di kawasan Silalas' },
  { id: 14, category: 'Kenali Rute', question: 'Rute mana yang memadukan suasana kampung dan pemakaman hijau?', options: ['Trails 1', 'Trails 3', 'Trails 4', 'Trails 5'], correct: 'Trails 5', explanation: 'Trails 5 bertema Kampung dan Pemakaman Hijau.', image: 'assets/kampung-silalas.jpg', alt: 'Lingkungan hijau di kawasan Kampung Silalas' },
  { id: 15, category: 'Kategori Lokasi', question: 'Apa arti kategori iSurprise dalam perjalanan?', options: ['Tempat makan utama', 'Tempat minum', 'Kejutan menarik yang sering terlewat', 'Tempat berbelanja'], correct: 'Kejutan menarik yang sering terlewat', explanation: 'iSurprise menandai temuan menarik yang mudah terlewat saat menjelajah.', image: 'assets/jembatan-rel.jpg', alt: 'Jembatan kereta api sebagai salah satu kejutan perjalanan' }
];

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = crypto.randomInt(index + 1);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function makeCode(rooms) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '';
    for (let index = 0; index < 6; index += 1) code += alphabet[crypto.randomInt(alphabet.length)];
    if (!rooms.has(code)) return code;
  }
  return crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
}

function prepareQuestions(source = QUESTION_BANK) {
  return shuffle(source).map((question) => {
    const options = shuffle(question.options);
    return { ...question, options, correctIndex: options.indexOf(question.correct) };
  });
}

function publicQuestion(question) {
  const { correct, correctIndex, explanation, ...safe } = question;
  return safe;
}

function leaderboard(room) {
  return [...room.participants.values()]
    .sort((a, b) => b.score - a.score || b.correctCount - a.correctCount || a.joinedAt - b.joinedAt)
    .map((participant, index) => ({
      id: participant.id,
      rank: index + 1,
      name: participant.name,
      className: participant.className,
      score: participant.score,
      correctCount: participant.correctCount,
      maxStreak: participant.maxStreak,
      connected: participant.connected
    }));
}

function participantList(room) {
  return [...room.participants.values()].map((participant) => ({
    id: participant.id,
    name: participant.name,
    className: participant.className,
    connected: participant.connected,
    answered: participant.answered
  }));
}

function createQuizServer(options = {}) {
  const questionDurationMs = options.questionDurationMs || Number(process.env.QUESTION_DURATION_MS) || 10_000;
  const revealDurationMs = options.revealDurationMs || Number(process.env.REVEAL_DURATION_MS) || 5_000;
  const app = express();
  app.set('trust proxy', 1);
  const database = options.database || createDatabase(options.connectionString);
  const allowedOrigins = new Set(
    (process.env.ALLOWED_ORIGINS || 'https://quiz-smpn7-production.up.railway.app,https://urbanmorphsoc.com')
      .split(',').map((origin) => origin.trim()).filter(Boolean)
  );
  const publicJoinUrl = process.env.PUBLIC_JOIN_URL
    || (process.env.NODE_ENV === 'production' ? 'https://urbanmorphsoc.com/medansimpang/game/' : '');
  const localEmbedOrigins = ['http://localhost:*', 'https://localhost:*', 'http://127.0.0.1:*'];
  const allowOrigin = (origin) => !origin
    || allowedOrigins.has(origin)
    || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) { callback(null, allowOrigin(origin)); },
      credentials: true
    },
    pingInterval: 10_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 100_000,
    allowRequest(request, callback) {
      callback(null, allowOrigin(request.headers.origin));
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 5 * 60 * 1000,
      skipMiddlewares: true
    }
  });
  const rooms = new Map();

  const PgSession = connectPgSimple(session);
  const sessionMiddleware = session({
    name: 'medan_simpang_admin',
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    proxy: true,
    store: database.enabled ? new PgSession({ pool: database.pool, createTableIfMissing: true }) : undefined,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 12 * 60 * 60 * 1000
    }
  });

  app.use(helmet({
    frameguard: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        frameAncestors: ["'self'", ...allowedOrigins, ...localEmbedOrigins]
      }
    }
  }));
  app.use(express.json({ limit: '200kb' }));
  app.use(sessionMiddleware);
  io.engine.use(sessionMiddleware);
  const ready = database.initialize(QUESTION_BANK);

  app.disable('x-powered-by');
  app.get('/health', (_request, response) => response.json({ ok: true, rooms: rooms.size, database: database.enabled }));
  app.get('/favicon.ico', (_request, response) => response.sendFile(path.join(__dirname, 'assets', 'favicon.ico')));
  app.get('/', (_request, response) => response.sendFile(path.join(__dirname, 'index.html')));
  app.get('/join', (_request, response) => response.sendFile(path.join(__dirname, 'index.html')));
  app.get('/game', (_request, response) => response.sendFile(path.join(__dirname, 'index.html')));
  app.get(['/admin', '/admin/login'], (_request, response) => response.sendFile(path.join(__dirname, 'admin.html')));
  app.get('/styles.css', (_request, response) => response.sendFile(path.join(__dirname, 'styles.css')));
  app.get('/client.js', (_request, response) => response.sendFile(path.join(__dirname, 'client.js')));
  app.get('/admin.js', (_request, response) => response.sendFile(path.join(__dirname, 'admin.js')));
  app.use('/api/admin', createAdminRouter(database));
  app.get('/api/rooms/:code/qr', async (request, response) => {
    const code = cleanText(request.params.code, 6).toUpperCase();
    if (!rooms.has(code)) return response.status(404).json({ error: 'Room tidak ditemukan.' });
    try {
      const joinUrl = new URL(publicJoinUrl || `${request.protocol}://${request.get('host')}/join`);
      joinUrl.searchParams.set('room', code);
      const svg = await QRCode.toString(joinUrl.toString(), {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 280,
        color: { dark: '#173f49', light: '#ffffff' }
      });
      response.set('Cache-Control', 'no-store');
      response.type('image/svg+xml').send(svg);
    } catch (_error) {
      response.status(500).json({ error: 'QR code tidak dapat dibuat.' });
    }
  });
  app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: '7d', immutable: true }));
  app.use((error, _request, response, _next) => {
    console.error('HTTP request gagal:', error);
    response.status(500).json({ ok: false, error: 'Terjadi kesalahan pada server.' });
  });

  function clearRoomTimer(room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
  }

  function touch(room) {
    room.updatedAt = Date.now();
  }

  function roomSnapshot(room) {
    return {
      code: room.code,
      status: room.status,
      participantCount: room.participants.size,
      participants: participantList(room),
      currentIndex: room.currentIndex,
      totalQuestions: room.questionDefinition?.length || QUESTION_BANK.length,
      quizId: room.quizId || null,
      quizTitle: room.quizTitle || 'Medan Simpang',
      publicJoinUrl
    };
  }

  function emitLobby(room) {
    const snapshot = roomSnapshot(room);
    if (room.hostSocketId) io.to(room.hostSocketId).emit('room:lobby', snapshot);
    io.to(room.code).except(room.hostSocketId).emit('room:lobby', {
      code: room.code,
      status: room.status,
      participantCount: room.participants.size,
      currentIndex: room.currentIndex,
      totalQuestions: room.questionDefinition?.length || QUESTION_BANK.length,
      quizId: room.quizId || null,
      quizTitle: room.quizTitle || 'Medan Simpang'
    });
  }

  function emitRoster(room) {
    if (room.status === 'lobby') {
      emitLobby(room);
      return;
    }
    io.to(room.hostSocketId).emit('room:roster', {
      participantCount: room.participants.size,
      participants: participantList(room)
    });
  }

  function finishedPayload(room) {
    return {
      code: room.code,
      leaderboard: leaderboard(room),
      totalQuestions: room.questions.length
    };
  }

  async function finishRoom(room) {
    clearRoomTimer(room);
    room.status = 'finished';
    touch(room);
    if (database.enabled && room.sessionId) {
      try { await database.finishGameSession(room.sessionId, [...room.participants.values()]); }
      catch (error) { console.error('Gagal menyimpan hasil game:', error); }
    }
    io.to(room.code).emit('room:finished', finishedPayload(room));
  }

  function revealQuestion(room) {
    if (room.status !== 'question') return;
    clearRoomTimer(room);
    room.status = 'reveal';
    const question = room.questions[room.currentIndex];
    for (const participant of room.participants.values()) {
      if (!participant.answered) participant.streak = 0;
    }
    const nextAt = Date.now() + revealDurationMs;
    const standings = leaderboard(room);
    const playerResults = new Map([...room.participants.values()].map((participant) => [participant.id, {
      id: participant.id,
      isCorrect: participant.answered && participant.answerIndex === question.correctIndex,
      award: participant.lastAward,
      score: participant.score
    }]));
    room.lastReveal = {
      questionIndex: room.currentIndex,
      correctIndex: question.correctIndex,
      correctAnswer: question.correct,
      explanation: question.explanation,
      leaderboard: standings,
      nextAt,
      isLast: room.currentIndex === room.questions.length - 1
    };
    if (room.hostSocketId) {
      io.to(room.hostSocketId).emit('room:reveal', {
        ...room.lastReveal,
        playerResults: [...playerResults.values()]
      });
    }
    for (const participant of room.participants.values()) {
      const topStandings = standings.slice(0, 10);
      const selfStanding = standings.find((entry) => entry.id === participant.id);
      const compactStandings = selfStanding && !topStandings.some((entry) => entry.id === participant.id)
        ? [...topStandings, selfStanding]
        : topStandings;
      io.to(participant.socketId).emit('room:reveal', {
        ...room.lastReveal,
        leaderboard: compactStandings,
        playerResult: playerResults.get(participant.id)
      });
    }
    touch(room);
    room.timer = setTimeout(() => {
      if (room.currentIndex === room.questions.length - 1) void finishRoom(room);
      else startQuestion(room, room.currentIndex + 1);
    }, revealDurationMs);
  }

  function startQuestion(room, index) {
    clearRoomTimer(room);
    room.status = 'question';
    room.currentIndex = index;
    room.questionStartedAt = Date.now();
    room.currentQuestionDurationMs = room.questions[index].timeLimitMs || questionDurationMs;
    room.questionEndsAt = room.questionStartedAt + room.currentQuestionDurationMs;
    room.lastReveal = null;
    for (const participant of room.participants.values()) {
      participant.answered = false;
      participant.answerIndex = null;
      participant.lastAward = 0;
    }
    io.to(room.code).emit('room:question', {
      index,
      total: room.questions.length,
      question: publicQuestion(room.questions[index]),
      startedAt: room.questionStartedAt,
      endsAt: room.questionEndsAt,
      durationMs: room.currentQuestionDurationMs,
      participantCount: room.participants.size
    });
    touch(room);
    if (database.enabled && room.sessionId) {
      database.updateGameSession(room.sessionId, 'question', index, room.questionStartedAt)
        .catch((error) => console.error('Gagal menyimpan posisi soal:', error));
    }
    room.timer = setTimeout(() => revealQuestion(room), room.currentQuestionDurationMs + 80);
  }

  function getRoom(rawCode) {
    return rooms.get(cleanText(rawCode, 6).toUpperCase());
  }

  function withAck(ack, payload) {
    if (typeof ack === 'function') ack(payload);
  }

  io.on('connection', (socket) => {
    socket.on('host:create', async (payload = {}, ack) => {
      if (database.enabled && !socket.request.session?.adminId) {
        return withAck(ack, { ok: false, error: 'Login admin diperlukan untuk membuat room.' });
      }
      const hostName = cleanText(payload.hostName, 35);
      if (hostName.length < 2) return withAck(ack, { ok: false, error: 'Nama host minimal 2 karakter.' });
      let quiz = null;
      if (database.enabled) {
        try { quiz = await database.getQuiz(payload.quizId); }
        catch (error) {
          console.error('Gagal membaca quiz:', error);
          return withAck(ack, { ok: false, error: 'Quiz tidak dapat dimuat.' });
        }
        if (!quiz || quiz.status !== 'published' || !quiz.questions.length) {
          return withAck(ack, { ok: false, error: 'Pilih quiz published yang memiliki pertanyaan.' });
        }
      }
      const code = makeCode(rooms);
      const hostToken = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const questionDefinition = quiz?.questions || QUESTION_BANK;
      const room = {
        code,
        sessionId,
        quizId: quiz?.id || null,
        quizTitle: quiz?.title || 'Medan Simpang',
        questionDefinition,
        hostName,
        hostToken,
        hostSocketId: socket.id,
        status: 'lobby',
        participants: new Map(),
        questions: [],
        currentIndex: -1,
        questionStartedAt: 0,
        questionEndsAt: 0,
        currentQuestionDurationMs: questionDurationMs,
        timer: null,
        lastReveal: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      if (database.enabled) {
        try {
          await database.createGameSession({
            id: sessionId,
            quizId: quiz.id,
            roomCode: code,
            snapshot: { title: quiz.title, questions: questionDefinition }
          });
        } catch (error) {
          console.error('Gagal membuat game session:', error);
          return withAck(ack, { ok: false, error: 'Game session tidak dapat disimpan.' });
        }
      }
      rooms.set(code, room);
      socket.join(code);
      socket.data = { roomCode: code, role: 'host' };
      withAck(ack, { ok: true, code, hostToken, snapshot: roomSnapshot(room) });
    });

    socket.on('player:join', async (payload = {}, ack) => {
      const room = getRoom(payload.code);
      const name = cleanText(payload.name, 35);
      const className = cleanText(payload.className, 25);
      if (!room) return withAck(ack, { ok: false, error: 'Room tidak ditemukan. Periksa kembali kodenya.' });
      if (room.status !== 'lobby') return withAck(ack, { ok: false, error: 'Kuis di room ini sudah dimulai.' });
      if (room.participants.size >= 150) return withAck(ack, { ok: false, error: 'Room sudah mencapai batas 150 peserta.' });
      if (name.length < 2 || !className) return withAck(ack, { ok: false, error: 'Isi nama dan kelas dengan lengkap.' });
      const duplicate = [...room.participants.values()].some((item) => item.name.toLowerCase() === name.toLowerCase() && item.className.toLowerCase() === className.toLowerCase());
      if (duplicate) return withAck(ack, { ok: false, error: 'Nama dan kelas tersebut sudah terdaftar di room.' });
      const participant = {
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        socketId: socket.id,
        name,
        className,
        score: 0,
        correctCount: 0,
        streak: 0,
        maxStreak: 0,
        answered: false,
        answerIndex: null,
        lastAward: 0,
        connected: true,
        joinedAt: Date.now()
      };
      if (database.enabled && room.sessionId) {
        try { await database.addParticipant(room.sessionId, participant); }
        catch (error) {
          if (error.code === '23505') return withAck(ack, { ok: false, error: 'Nama dan kelas tersebut sudah terdaftar di room.' });
          console.error('Gagal menyimpan peserta:', error);
          return withAck(ack, { ok: false, error: 'Peserta tidak dapat disimpan.' });
        }
      }
      room.participants.set(participant.id, participant);
      socket.join(room.code);
      socket.data = { roomCode: room.code, role: 'player', participantId: participant.id };
      touch(room);
      withAck(ack, { ok: true, code: room.code, participantId: participant.id, playerToken: participant.token, snapshot: roomSnapshot(room) });
      emitLobby(room);
    });

    socket.on('session:resume', (payload = {}, ack) => {
      const room = getRoom(payload.code);
      if (!room) return withAck(ack, { ok: false, error: 'Room sudah tidak tersedia.' });
      if (payload.role === 'host' && payload.token === room.hostToken) {
        if (database.enabled && !socket.request.session?.adminId) {
          return withAck(ack, { ok: false, error: 'Sesi admin sudah berakhir. Silakan login kembali.' });
        }
        room.hostSocketId = socket.id;
        socket.join(room.code);
        socket.data = { roomCode: room.code, role: 'host' };
        withAck(ack, sessionResumePayload(room, 'host'));
        return;
      }
      const participant = room.participants.get(payload.participantId);
      if (!participant || payload.token !== participant.token) return withAck(ack, { ok: false, error: 'Sesi tidak dapat dipulihkan.' });
      participant.socketId = socket.id;
      participant.connected = true;
      socket.join(room.code);
      socket.data = { roomCode: room.code, role: 'player', participantId: participant.id };
      withAck(ack, sessionResumePayload(room, 'player', participant));
      emitRoster(room);
    });

    socket.on('host:start', (payload = {}, ack) => {
      const room = getRoom(payload.code);
      if (database.enabled && !socket.request.session?.adminId) return withAck(ack, { ok: false, error: 'Login admin diperlukan.' });
      if (!room || socket.data.role !== 'host' || room.hostSocketId !== socket.id) return withAck(ack, { ok: false, error: 'Hanya host room yang dapat memulai.' });
      if (room.status !== 'lobby') return withAck(ack, { ok: false, error: 'Kuis sudah berjalan.' });
      if (room.participants.size < 1) return withAck(ack, { ok: false, error: 'Tunggu minimal satu peserta bergabung.' });
      room.questions = prepareQuestions(room.questionDefinition);
      withAck(ack, { ok: true });
      startQuestion(room, 0);
    });

    socket.on('player:answer', (payload = {}, ack) => {
      const room = getRoom(payload.code);
      const participant = room?.participants.get(socket.data.participantId);
      if (!room || !participant || socket.data.role !== 'player') return withAck(ack, { ok: false, error: 'Sesi peserta tidak valid.' });
      if (room.status !== 'question' || payload.questionIndex !== room.currentIndex || Date.now() > room.questionEndsAt + 150) return withAck(ack, { ok: false, error: 'Waktu menjawab sudah habis.' });
      if (participant.answered) {
        const question = room.questions[room.currentIndex];
        return withAck(ack, {
          ok: true,
          duplicate: true,
          isCorrect: participant.answerIndex === question.correctIndex,
          award: participant.lastAward,
          score: participant.score,
          streak: participant.streak
        });
      }
      const answerIndex = Number(payload.answerIndex);
      if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) return withAck(ack, { ok: false, error: 'Pilihan jawaban tidak valid.' });
      participant.answered = true;
      participant.answerIndex = answerIndex;
      const question = room.questions[room.currentIndex];
      const isCorrect = answerIndex === question.correctIndex;
      let award = 0;
      if (isCorrect) {
        const responseTimeMs = Math.max(0, Date.now() - room.questionStartedAt);
        const remaining = Math.max(0, room.questionEndsAt - Date.now());
        const maximumPoints = question.basePoints || 1000;
        const minimumPoints = Math.round(maximumPoints * 0.5);
        const speedBonus = Math.round(((maximumPoints - minimumPoints) * (remaining / room.currentQuestionDurationMs)) / 10) * 10;
        award = minimumPoints + speedBonus;
        participant.score += award;
        participant.correctCount += 1;
        participant.streak += 1;
        participant.maxStreak = Math.max(participant.maxStreak, participant.streak);
      } else {
        participant.streak = 0;
      }
      participant.lastAward = award;
      touch(room);
      if (database.enabled && room.sessionId) {
        const responseTimeMs = Math.max(0, Date.now() - room.questionStartedAt);
        database.recordAnswer(room.sessionId, participant, question, room.currentIndex, answerIndex, isCorrect, responseTimeMs, award)
          .catch((error) => console.error('Gagal menyimpan jawaban:', error));
      }
      withAck(ack, { ok: true, isCorrect, award, score: participant.score, streak: participant.streak });
      io.to(room.hostSocketId).volatile.emit('room:progress', {
        answeredCount: [...room.participants.values()].filter((item) => item.answered).length,
        participantCount: room.participants.size
      });
    });

    socket.on('host:reset', (payload = {}, ack) => {
      const room = getRoom(payload.code);
      if (database.enabled && !socket.request.session?.adminId) return withAck(ack, { ok: false, error: 'Login admin diperlukan.' });
      if (!room || socket.data.role !== 'host' || room.hostSocketId !== socket.id) return withAck(ack, { ok: false, error: 'Hanya host room yang dapat mengulang.' });
      clearRoomTimer(room);
      room.status = 'lobby';
      room.questions = [];
      room.currentIndex = -1;
      room.lastReveal = null;
      for (const participant of room.participants.values()) {
        Object.assign(participant, { score: 0, correctCount: 0, streak: 0, maxStreak: 0, answered: false, answerIndex: null, lastAward: 0 });
      }
      touch(room);
      withAck(ack, { ok: true });
      emitLobby(room);
    });

    socket.on('disconnect', () => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return;
      if (socket.data.role === 'player') {
        const participant = room.participants.get(socket.data.participantId);
        if (participant) participant.connected = false;
        emitRoster(room);
      }
      touch(room);
    });
  });

  function currentQuestionPayload(room, participant) {
    return {
      index: room.currentIndex,
      total: room.questions.length,
      question: publicQuestion(room.questions[room.currentIndex]),
      startedAt: room.questionStartedAt,
      endsAt: room.questionEndsAt,
      durationMs: room.currentQuestionDurationMs,
      answerIndex: participant?.answered ? participant.answerIndex : null,
      answerResult: participant?.answered ? {
        isCorrect: participant.answerIndex === room.questions[room.currentIndex].correctIndex,
        award: participant.lastAward,
        score: participant.score,
        streak: participant.streak
      } : null,
      participantCount: room.participants.size
    };
  }

  function sessionResumePayload(room, role, participant) {
    let standings = leaderboard(room);
    if (role === 'player' && room.status !== 'finished') {
      const top = standings.slice(0, 10);
      const self = standings.find((entry) => entry.id === participant?.id);
      standings = self && !top.some((entry) => entry.id === self.id) ? [...top, self] : top;
    }
    const payload = {
      ok: true,
      role,
      player: participant ? publicPlayer(participant) : undefined,
      snapshot: roomSnapshot(room),
      leaderboard: standings
    };
    if (room.status === 'question' || room.status === 'reveal') {
      payload.currentQuestion = currentQuestionPayload(room, participant);
    }
    if (room.status === 'reveal') {
      const result = participant ? {
        id: participant.id,
        isCorrect: participant.answered && participant.answerIndex === room.questions[room.currentIndex].correctIndex,
        award: participant.lastAward,
        score: participant.score
      } : undefined;
      payload.reveal = { ...room.lastReveal, leaderboard: standings, playerResult: result };
    }
    if (room.status === 'finished') payload.result = finishedPayload(room);
    return payload;
  }

  function publicPlayer(participant) {
    return { id: participant.id, name: participant.name, className: participant.className, score: participant.score, correctCount: participant.correctCount, streak: participant.streak, maxStreak: participant.maxStreak, answered: participant.answered };
  }

  const cleanup = setInterval(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [code, room] of rooms.entries()) {
      if (room.updatedAt < cutoff) {
        clearRoomTimer(room);
        rooms.delete(code);
      }
    }
  }, 15 * 60 * 1000);
  cleanup.unref();

  return {
    app,
    httpServer,
    io,
    rooms,
    database,
    ready,
    close: () => new Promise((resolve) => {
      for (const room of rooms.values()) clearRoomTimer(room);
      io.close(async () => {
        if (httpServer.listening) await new Promise((closeResolve) => httpServer.close(closeResolve));
        await database.close();
        resolve();
      });
    })
  };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const quiz = createQuizServer();
  quiz.ready.then(() => {
    quiz.httpServer.listen(port, '0.0.0.0', () => console.log(`Misi Simpang berjalan di http://0.0.0.0:${port}`));
  }).catch((error) => {
    console.error('Database tidak dapat diinisialisasi:', error);
    process.exit(1);
  });
  const shutdown = async (signal) => {
    console.log(`${signal} diterima, menutup server dengan aman.`);
    await quiz.close();
    process.exit(0);
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { createQuizServer, QUESTION_BANK };
