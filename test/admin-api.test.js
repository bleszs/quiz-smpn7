const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const express = require('express');
const session = require('express-session');
const { createAdminRouter } = require('../src/admin-routes');

const validQuestion = {
  category: 'Lokasi',
  prompt: 'Di mana lokasi SMP-SMA Kalam Kudus?',
  options: ['Jl. Mayang No. 10', 'Jl. Kemiri', 'Jl. Sei Deli', 'Jl. Nangka'],
  correctOptionIndex: 0,
  timeLimitSeconds: 10,
  basePoints: 1000,
  explanation: 'Lokasinya berada di Jl. Mayang No. 10.',
  imageUrl: 'assets/kampung-silalas.jpg',
  altText: 'Kawasan Silalas'
};

async function createTestApp() {
  const passwordHash = await bcrypt.hash('adminquiz123', 4);
  let storedQuestion = null;
  const database = {
    enabled: true,
    countAdmins: async () => 1,
    findAdminByUsername: async (username) => username === 'adminquiz'
      ? { id: 'admin-1', username, password_hash: passwordHash }
      : null,
    getQuiz: async (id) => id === 'quiz-1' ? { id, title: 'Quiz Uji', questions: [] } : null,
    createQuestion: async (_quizId, question) => {
      storedQuestion = { id: 'question-1', question: question.prompt, ...question };
      return storedQuestion;
    },
    updateQuestion: async (_quizId, questionId, question) => {
      if (questionId !== 'question-1') return null;
      storedQuestion = { id: questionId, question: question.prompt, ...question };
      return storedQuestion;
    },
    deleteQuestion: async (_quizId, questionId) => {
      if (questionId !== 'question-1') return false;
      storedQuestion = null;
      return true;
    }
  };
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-session-secret-32-characters', resave: false, saveUninitialized: false }));
  app.use('/api/admin', createAdminRouter(database));
  app.use((error, _request, response, _next) => response.status(500).json({ error: error.message }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test('admin login memakai username dan CRUD tiap pertanyaan tersimpan melalui API', async (t) => {
  const { server, url } = await createTestApp();
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const login = await fetch(`${url}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'adminquiz', password: 'adminquiz123' })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const created = await fetch(`${url}/api/admin/quizzes/quiz-1/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(validQuestion)
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).question.question, validQuestion.prompt);

  const updatedPrompt = 'Apa nama website yang sedang digunakan?';
  const updated = await fetch(`${url}/api/admin/quizzes/quiz-1/questions/question-1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ ...validQuestion, prompt: updatedPrompt })
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).question.question, updatedPrompt);

  const deleted = await fetch(`${url}/api/admin/quizzes/quiz-1/questions/question-1`, {
    method: 'DELETE',
    headers: { Cookie: cookie }
  });
  assert.equal(deleted.status, 200);
});
