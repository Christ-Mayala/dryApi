/**
 * Tests d'integration — Pelerin / feature "quiz" (+ quizAttempt)
 *
 * Verifie surtout que la correction reste server-side only : la liste
 * publique/getById ne doit JAMAIS exposer correctAnswerIndex/explanation avant
 * qu'une tentative soit soumise (quiz.answer), qui seul les revele.
 *
 * @module tests/Pelerin/quiz.test
 */

const { setupPelerinTestDB, getPelerinModel, buildReq, buildRes } = require('./_helpers/pelerinTestUtils');

const QuizSchema = require('../../dryApp/Pelerin/features/quiz/model/quiz.schema');
const QuizAttemptSchema = require('../../dryApp/Pelerin/features/quizAttempt/model/quizAttempt.schema');

const createQuiz = require('../../dryApp/Pelerin/features/quiz/controller/quiz.create.controller');
const getAllQuiz = require('../../dryApp/Pelerin/features/quiz/controller/quiz.getAll.controller');
const getByIdQuiz = require('../../dryApp/Pelerin/features/quiz/controller/quiz.getById.controller');
const answerQuiz = require('../../dryApp/Pelerin/features/quiz/controller/quiz.answer.controller');

const questionPayload = {
  question: 'Qui a construit l arche ?',
  options: ['Noe', 'Moise', 'Abraham', 'David'],
  correctAnswerIndex: 0,
  explanation: 'Genese 6-9 : Noe construit l arche sur ordre de Dieu.',
  theme: 'ancien-testament',
  difficulty: 'easy',
};

describe('Pelerin — quiz', () => {
  setupPelerinTestDB();

  it('cree une question (admin, via controller create)', async () => {
    const req = buildReq({ body: questionPayload });
    const res = buildRes();
    await createQuiz(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.question).toBe(questionPayload.question);
    expect(res.body.data.correctAnswerIndex).toBe(0);
  });

  it("getAll (liste publique) NE renvoie PAS correctAnswerIndex ni explanation", async () => {
    await createQuiz(buildReq({ body: questionPayload }), buildRes());

    const listRes = buildRes();
    await getAllQuiz(buildReq(), listRes);

    expect(listRes.body.data).toHaveLength(1);
    const publicQuestion = listRes.body.data[0];
    expect(publicQuestion.question).toBe(questionPayload.question);
    expect(publicQuestion.correctAnswerIndex).toBeUndefined();
    expect(publicQuestion.explanation).toBeUndefined();
  });

  it("getById NE renvoie PAS correctAnswerIndex ni explanation", async () => {
    const createRes = buildRes();
    await createQuiz(buildReq({ body: questionPayload }), createRes);
    const quizId = createRes.body.data._id;

    const getRes = buildRes();
    await getByIdQuiz(buildReq({ params: { id: String(quizId) } }), getRes);

    expect(getRes.body.data.correctAnswerIndex).toBeUndefined();
    expect(getRes.body.data.explanation).toBeUndefined();
  });

  it('quiz.answer valide server-side, revele la correction et enregistre la tentative', async () => {
    const createRes = buildRes();
    await createQuiz(buildReq({ body: questionPayload }), createRes);
    const quizId = createRes.body.data._id;

    const req = buildReq({ params: { id: String(quizId) }, body: { selectedIndex: 0 } });
    const res = buildRes();
    await answerQuiz(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.isCorrect).toBe(true);
    expect(res.body.data.correctAnswerIndex).toBe(0);
    expect(res.body.data.explanation).toBe(questionPayload.explanation);

    const AttemptModel = getPelerinModel('QuizAttempt', QuizAttemptSchema);
    const attempts = await AttemptModel.find({ createdBy: req.user.id, questionId: quizId });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].isCorrect).toBe(true);
    expect(attempts[0].selectedIndex).toBe(0);
  });

  it('quiz.answer signale une reponse incorrecte sans jamais faire confiance au client', async () => {
    const createRes = buildRes();
    await createQuiz(buildReq({ body: questionPayload }), createRes);
    const quizId = createRes.body.data._id;

    const req = buildReq({ params: { id: String(quizId) }, body: { selectedIndex: 2 } });
    const res = buildRes();
    await answerQuiz(req, res);

    expect(res.body.data.isCorrect).toBe(false);
    // La correction reste revelee malgre l'erreur (feedback pedagogique)
    expect(res.body.data.correctAnswerIndex).toBe(0);
  });

  it('rejette (404) une reponse sur une question inexistante', async () => {
    const fakeId = new (require('mongoose').Types.ObjectId)().toString();
    const req = buildReq({ params: { id: fakeId }, body: { selectedIndex: 0 } });
    await expect(answerQuiz(req, buildRes())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('le filtre theme/difficulty de getAll fonctionne', async () => {
    await createQuiz(buildReq({ body: questionPayload }), buildRes());
    await createQuiz(
      buildReq({
        body: { ...questionPayload, question: 'Qui a trahi Jesus ?', theme: 'nouveau-testament', difficulty: 'medium' },
      }),
      buildRes(),
    );

    const filteredRes = buildRes();
    await getAllQuiz(buildReq({ query: { theme: 'nouveau-testament' } }), filteredRes);
    expect(filteredRes.body.data).toHaveLength(1);
    expect(filteredRes.body.data[0].question).toBe('Qui a trahi Jesus ?');
  });
});
