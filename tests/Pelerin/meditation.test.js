/**
 * Tests d'integration — Pelerin / features "meditation" (editorial, lecture
 * publique) + "meditationLog" (personnel, prive par utilisateur).
 *
 * "Meditation" est du contenu editorial cree via le crudFactory generique
 * (buildCrudHandlers, pas de controller dedie sous features/meditation/controller/) :
 * on simule la creation admin en appelant directement le Model, comme pour
 * "parcours". "MeditationLog" a ses propres controllers dedies, testes ici.
 *
 * @module tests/Pelerin/meditation.test
 */

const { setupPelerinTestDB, getPelerinModel, buildReq, buildRes } = require('./_helpers/pelerinTestUtils');

const MeditationSchema = require('../../dryApp/Pelerin/features/meditation/model/meditation.schema');
const MeditationLogSchema = require('../../dryApp/Pelerin/features/meditationLog/model/meditationLog.schema');

const createMeditationLog = require('../../dryApp/Pelerin/features/meditationLog/controller/meditationLog.create.controller');
const deleteMeditationLog = require('../../dryApp/Pelerin/features/meditationLog/controller/meditationLog.delete.controller');
const getAllMeditationLog = require('../../dryApp/Pelerin/features/meditationLog/controller/meditationLog.getAll.controller');

const createEditorialMeditation = async () => {
  const Model = getPelerinModel('Meditation', MeditationSchema);
  return Model.create({
    title: 'Le repos en Dieu',
    bookCode: 'mat',
    chapter: 11,
    verseStart: 28,
    reflection: 'Venez a moi...',
    prayer: 'Seigneur, donne-moi le repos.',
  });
};

describe('Pelerin — meditation + meditationLog', () => {
  setupPelerinTestDB();

  it('une meditation editoriale est lisible publiquement (pas de filtre par utilisateur)', async () => {
    const meditation = await createEditorialMeditation();
    const Model = getPelerinModel('Meditation', MeditationSchema);
    const found = await Model.findById(meditation._id);
    expect(found).not.toBeNull();
    expect(found.title).toBe('Le repos en Dieu');
  });

  it('enregistre un ressenti personnel (meditationLog) lie a la meditation', async () => {
    const meditation = await createEditorialMeditation();
    const req = buildReq({
      body: { meditationId: String(meditation._id), feeling: 'paix', thoughts: 'Ca m a touche' },
    });
    const res = buildRes();

    await createMeditationLog(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.feeling).toBe('paix');
    expect(String(res.body.data.createdBy?._id || res.body.data.createdBy)).toBe(req.user.id);
  });

  it('rejette la creation d un log sans meditationId', async () => {
    const req = buildReq({ body: { feeling: 'doute' } });
    const res = buildRes();
    await expect(createMeditationLog(req, res)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('getAll ne renvoie que les logs du user courant', async () => {
    const meditation = await createEditorialMeditation();
    const userAReq = buildReq({ body: { meditationId: String(meditation._id), feeling: 'joie' } });
    await createMeditationLog(userAReq, buildRes());

    const userBReq = buildReq({ body: { meditationId: String(meditation._id), feeling: 'tristesse' } });
    await createMeditationLog(userBReq, buildRes());

    const listReqA = buildReq({ user: userAReq.user });
    const listResA = buildRes();
    await getAllMeditationLog(listReqA, listResA);

    expect(listResA.body.data).toHaveLength(1);
    expect(listResA.body.data[0].feeling).toBe('joie');
  });

  it("un utilisateur ne peut pas supprimer le log meditationLog d'un autre utilisateur", async () => {
    const meditation = await createEditorialMeditation();
    const ownerReq = buildReq({ body: { meditationId: String(meditation._id), feeling: 'paix' } });
    const ownerRes = buildRes();
    await createMeditationLog(ownerReq, ownerRes);
    const logId = ownerRes.body.data._id;

    const strangerReq = buildReq({ params: { id: String(logId) } });
    await expect(deleteMeditationLog(strangerReq, buildRes())).rejects.toMatchObject({ statusCode: 404 });

    const ownerDeleteReq = buildReq({ user: ownerReq.user, params: { id: String(logId) } });
    const ownerDeleteRes = buildRes();
    await deleteMeditationLog(ownerDeleteReq, ownerDeleteRes);
    expect(ownerDeleteRes.body.success).toBe(true);

    const LogModel = getPelerinModel('MeditationLog', MeditationLogSchema);
    const stillThere = await LogModel.findById(logId);
    expect(stillThere).toBeNull(); // deleteOne() = suppression reelle (pas soft-delete) pour ce log
  });
});
