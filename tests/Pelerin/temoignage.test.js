/**
 * Tests d'integration — Pelerin / feature "temoignage"
 *
 * Property 17 (Requirement 17.7) : un temoignage soumis par un utilisateur
 * reste invisible du public tant qu'il n'est pas approuve par un admin ;
 * apres approbation il apparait dans la liste publique et disparait de la
 * file de moderation "/pending".
 *
 * @module tests/Pelerin/temoignage.test
 */

const { setupPelerinTestDB, buildReq, buildRes } = require('./_helpers/pelerinTestUtils');

const createTemoignage = require('../../dryApp/Pelerin/features/temoignage/controller/temoignage.create.controller');
const getAllTemoignage = require('../../dryApp/Pelerin/features/temoignage/controller/temoignage.getAll.controller');
const getPendingTemoignage = require('../../dryApp/Pelerin/features/temoignage/controller/temoignage.getPending.controller');
const getMineTemoignage = require('../../dryApp/Pelerin/features/temoignage/controller/temoignage.getMine.controller');
const getByIdTemoignage = require('../../dryApp/Pelerin/features/temoignage/controller/temoignage.getById.controller');
const updateTemoignage = require('../../dryApp/Pelerin/features/temoignage/controller/temoignage.update.controller');
const deleteTemoignage = require('../../dryApp/Pelerin/features/temoignage/controller/temoignage.delete.controller');

const submitPayload = {
  title: 'De la depression a la paix',
  before: 'Je me sentais perdu',
  encounter: "J'ai rencontre le Christ lors d'une retraite",
  after: 'Je vis dans la paix',
};

describe('Pelerin — temoignage', () => {
  setupPelerinTestDB();

  it("soumettre un temoignage le place en attente (isApproved=false), invisible du public", async () => {
    const submitter = buildReq({ body: submitPayload });
    const submitRes = buildRes();
    await createTemoignage(submitter, submitRes);

    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.data.isApproved).toBe(false);
    const temoignageId = submitRes.body.data._id;

    // Invisible de la liste publique
    const publicRes = buildRes();
    await getAllTemoignage(buildReq(), publicRes);
    expect(publicRes.body.data.find((t) => String(t._id) === String(temoignageId))).toBeUndefined();

    // Visible dans la file de moderation admin
    const pendingRes = buildRes();
    await getPendingTemoignage(buildReq(), pendingRes);
    expect(pendingRes.body.data.some((t) => String(t._id) === String(temoignageId))).toBe(true);

    // Visible par son auteur via /mine
    const mineRes = buildRes();
    await getMineTemoignage(buildReq({ user: submitter.user }), mineRes);
    expect(mineRes.body.data.some((t) => String(t._id) === String(temoignageId))).toBe(true);

    // Pas encore accessible via getById public (isApproved:true requis)
    const getByIdRes = buildRes();
    await expect(
      getByIdTemoignage(buildReq({ params: { id: String(temoignageId) } }), getByIdRes),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("apres approbation admin, le temoignage apparait dans la liste publique et disparait de /pending", async () => {
    const submitter = buildReq({ body: submitPayload });
    const submitRes = buildRes();
    await createTemoignage(submitter, submitRes);
    const temoignageId = submitRes.body.data._id;

    // Simule l'approbation par un admin (isApproved:true), via update controller
    const adminReq = buildReq({
      params: { id: String(temoignageId) },
      body: { isApproved: true },
      user: { id: buildReq().user.id, role: 'admin' },
    });
    const adminRes = buildRes();
    await updateTemoignage(adminReq, adminRes);
    expect(adminRes.body.data.isApproved).toBe(true);

    // Maintenant visible publiquement
    const publicRes = buildRes();
    await getAllTemoignage(buildReq(), publicRes);
    expect(publicRes.body.data.some((t) => String(t._id) === String(temoignageId))).toBe(true);

    const getByIdRes = buildRes();
    await getByIdTemoignage(buildReq({ params: { id: String(temoignageId) } }), getByIdRes);
    expect(getByIdRes.body.data.title).toBe(submitPayload.title);

    // Plus dans la file de moderation
    const pendingRes = buildRes();
    await getPendingTemoignage(buildReq(), pendingRes);
    expect(pendingRes.body.data.find((t) => String(t._id) === String(temoignageId))).toBeUndefined();
  });

  it("l'auteur ne peut plus modifier son temoignage une fois approuve (seul l'admin le peut)", async () => {
    const submitter = buildReq({ body: submitPayload });
    const submitRes = buildRes();
    await createTemoignage(submitter, submitRes);
    const temoignageId = submitRes.body.data._id;

    const adminReq = buildReq({
      params: { id: String(temoignageId) },
      body: { isApproved: true },
      user: { id: buildReq().user.id, role: 'admin' },
    });
    await updateTemoignage(adminReq, buildRes());

    // L'auteur original tente de modifier apres approbation -> refuse (403)
    const authorEditReq = buildReq({
      user: submitter.user,
      params: { id: String(temoignageId) },
      body: { title: 'Titre modifie par l auteur' },
    });
    await expect(updateTemoignage(authorEditReq, buildRes())).rejects.toMatchObject({ statusCode: 403 });
  });

  it("un autre utilisateur (non auteur, non admin) ne peut ni modifier ni supprimer le temoignage", async () => {
    const submitter = buildReq({ body: submitPayload });
    const submitRes = buildRes();
    await createTemoignage(submitter, submitRes);
    const temoignageId = submitRes.body.data._id;

    const strangerReq = buildReq({ params: { id: String(temoignageId) }, body: { title: 'Vole' } });
    await expect(updateTemoignage(strangerReq, buildRes())).rejects.toMatchObject({ statusCode: 403 });

    const strangerDeleteReq = buildReq({ params: { id: String(temoignageId) } });
    await expect(deleteTemoignage(strangerDeleteReq, buildRes())).rejects.toMatchObject({ statusCode: 403 });
  });

  it("l'auteur peut supprimer son propre temoignage (soft-delete)", async () => {
    const submitter = buildReq({ body: submitPayload });
    const submitRes = buildRes();
    await createTemoignage(submitter, submitRes);
    const temoignageId = submitRes.body.data._id;

    const deleteReq = buildReq({ user: submitter.user, params: { id: String(temoignageId) } });
    const deleteRes = buildRes();
    await deleteTemoignage(deleteReq, deleteRes);
    expect(deleteRes.body.success).toBe(true);

    const pendingRes = buildRes();
    await getPendingTemoignage(buildReq(), pendingRes);
    expect(pendingRes.body.data.find((t) => String(t._id) === String(temoignageId))).toBeUndefined();
  });
});
