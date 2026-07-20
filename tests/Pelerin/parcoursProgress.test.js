/**
 * Tests d'integration — Pelerin / features "parcours" + "parcoursProgress"
 *
 * "Parcours" est du contenu editorial (admin) cree via le crudFactory generique
 * (dry/core/factories/crudFactory.js buildCrudHandlers) — pas de controller
 * dedie sous features/parcours/controller/. On simule donc la creation admin en
 * appelant directement le Model (comme le ferait buildCrudHandlers.createOne),
 * puis on teste les vrais controllers "parcoursProgress" (personnels, par user).
 *
 * @module tests/Pelerin/parcoursProgress.test
 */

const {
  setupPelerinTestDB,
  getPelerinModel,
  buildReq,
  buildRes,
} = require('./_helpers/pelerinTestUtils');

const ParcoursSchema = require('../../dryApp/Pelerin/features/parcours/model/parcours.schema');
const ParcoursProgressSchema = require('../../dryApp/Pelerin/features/parcoursProgress/model/parcoursProgress.schema');

const completeStep = require('../../dryApp/Pelerin/features/parcoursProgress/controller/parcoursProgress.completeStep.controller');
const getAllProgress = require('../../dryApp/Pelerin/features/parcoursProgress/controller/parcoursProgress.getAll.controller');
const getOneProgress = require('../../dryApp/Pelerin/features/parcoursProgress/controller/parcoursProgress.getOne.controller');

const createEditorialParcours = async (stepsCount = 3) => {
  const ParcoursModel = getPelerinModel('Parcours', ParcoursSchema);
  const steps = Array.from({ length: stepsCount }, (_, i) => ({
    order: i + 1,
    title: `Etape ${i + 1}`,
  }));
  return ParcoursModel.create({
    title: 'Decouvrir Jesus',
    description: 'Un parcours de 3 etapes',
    steps,
  });
};

describe('Pelerin — parcours + parcoursProgress', () => {
  setupPelerinTestDB();

  it('getOne renvoie un etat "pas encore commence" si aucune progression n existe', async () => {
    const parcours = await createEditorialParcours();
    const req = buildReq({ params: { parcoursId: String(parcours._id) } });
    const res = buildRes();

    await getOneProgress(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.currentStepOrder).toBe(0);
    expect(res.body.data.completedSteps).toEqual([]);
  });

  it('completer la premiere etape cree la progression et avance currentStepOrder', async () => {
    const parcours = await createEditorialParcours();
    const req = buildReq({ params: { parcoursId: String(parcours._id) }, body: { stepOrder: 1 } });
    const res = buildRes();

    await completeStep(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.completedSteps).toEqual([1]);
    expect(res.body.data.currentStepOrder).toBe(2);
    expect(res.body.data.completedAt).toBeNull();
  });

  it('completer toutes les etapes marque completedAt', async () => {
    const parcours = await createEditorialParcours(2);
    const user = { id: buildReq().user.id };

    await completeStep(
      buildReq({ user, params: { parcoursId: String(parcours._id) }, body: { stepOrder: 1 } }),
      buildRes(),
    );
    const res2 = buildRes();
    await completeStep(
      buildReq({ user, params: { parcoursId: String(parcours._id) }, body: { stepOrder: 2 } }),
      res2,
    );

    expect(res2.body.data.completedSteps.sort()).toEqual([1, 2]);
    expect(res2.body.data.currentStepOrder).toBe(3);
    expect(res2.body.data.completedAt).not.toBeNull();
  });

  it('completer deux fois la meme etape ne duplique pas completedSteps', async () => {
    const parcours = await createEditorialParcours();
    const user = { id: buildReq().user.id };

    await completeStep(
      buildReq({ user, params: { parcoursId: String(parcours._id) }, body: { stepOrder: 1 } }),
      buildRes(),
    );
    const res2 = buildRes();
    await completeStep(
      buildReq({ user, params: { parcoursId: String(parcours._id) }, body: { stepOrder: 1 } }),
      res2,
    );

    expect(res2.body.data.completedSteps).toEqual([1]);
    // currentStepOrder ne recule pas non plus (Math.max)
    expect(res2.body.data.currentStepOrder).toBe(2);
  });

  it('la progression est strictement scopee par utilisateur (Requirement 15.1)', async () => {
    const parcours = await createEditorialParcours();
    const userA = { id: buildReq().user.id };
    const userB = { id: buildReq().user.id };

    await completeStep(
      buildReq({ user: userA, params: { parcoursId: String(parcours._id) }, body: { stepOrder: 1 } }),
      buildRes(),
    );

    // B n'a rien complete : getOne pour B doit rester "pas commence"
    const getOneReqB = buildReq({ user: userB, params: { parcoursId: String(parcours._id) } });
    const getOneResB = buildRes();
    await getOneProgress(getOneReqB, getOneResB);
    expect(getOneResB.body.data.currentStepOrder).toBe(0);

    // getAll pour A ne renvoie que sa propre progression
    const getAllReqA = buildReq({ user: userA });
    const getAllResA = buildRes();
    await getAllProgress(getAllReqA, getAllResA);
    expect(getAllResA.body.data).toHaveLength(1);
    expect(getAllResA.body.data[0].completedSteps).toEqual([1]);

    const getAllReqB = buildReq({ user: userB });
    const getAllResB = buildRes();
    await getAllProgress(getAllReqB, getAllResB);
    expect(getAllResB.body.data).toHaveLength(0);
  });

  it('rejette (404) la completion d etape sur un parcours inexistant', async () => {
    const fakeParcoursId = new (require('mongoose').Types.ObjectId)().toString();
    const req = buildReq({ params: { parcoursId: fakeParcoursId }, body: { stepOrder: 1 } });
    const res = buildRes();

    await expect(completeStep(req, res)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejette (400) un stepOrder invalide (< 1 ou absent)', async () => {
    const parcours = await createEditorialParcours();
    const req = buildReq({ params: { parcoursId: String(parcours._id) }, body: { stepOrder: 0 } });
    const res = buildRes();

    await expect(completeStep(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });
});
