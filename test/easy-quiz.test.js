const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { validateQuestions, validateQuiz } = require('../src/admin-routes');
const { EASY_QUIZ } = require('../src/easy-quiz');

test('quiz mudah siap dipublikasikan dengan 15 soal valid', () => {
  const quizValidation = validateQuiz(EASY_QUIZ);
  assert.equal(quizValidation.error, undefined);
  assert.equal(EASY_QUIZ.status, 'published');
  assert.equal(EASY_QUIZ.seedVersion, 3);
  assert.equal(EASY_QUIZ.questions.length, 15);
  assert.ok(EASY_QUIZ.questions.some((question) => question.prompt === 'Apa nama website yang sedang kita gunakan?'));
  assert.equal(EASY_QUIZ.questions[9].prompt, 'SMP-SMA Kalam Kudus termasuk kategori lokasi apa di Medan Simpang?');
  assert.equal(EASY_QUIZ.questions[9].options[EASY_QUIZ.questions[9].correctOptionIndex], 'iSee');
  assert.equal(EASY_QUIZ.questions[10].prompt, 'Di manakah lokasi SMP-SMA Kalam Kudus?');
  assert.equal(EASY_QUIZ.questions[10].options[EASY_QUIZ.questions[10].correctOptionIndex], 'Jl. Mayang No. 10, Sekip');
  assert.deepEqual(
    EASY_QUIZ.questions.slice(11, 15).map((question) => question.options[question.correctOptionIndex]),
    ['Rumah Qohwah', 'Dapur Sedap Wangi', 'Sungai Deli', 'Trail 4']
  );

  const questionsValidation = validateQuestions({
    questions: EASY_QUIZ.questions.map((question) => ({
      ...question,
      timeLimitSeconds: question.timeLimitMs / 1000
    }))
  });
  assert.equal(questionsValidation.error, undefined);
  assert.equal(questionsValidation.value.length, 15);

  EASY_QUIZ.questions.forEach((question) => {
    assert.equal(question.options.length, 4);
    assert.ok(question.correctOptionIndex >= 0 && question.correctOptionIndex <= 3);
    assert.ok(question.explanation.length > 0);
    assert.equal(question.timeLimitMs, 10_000);
    assert.equal(fs.existsSync(path.join(__dirname, '..', question.imageUrl)), true, question.imageUrl);
  });
});
