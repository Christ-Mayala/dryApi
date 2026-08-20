/**
 * Tests d'integration — Pelerin / housePreaching « suivis de prêcheurs »
 *
 * Endpoints personnels (synchronisés entre appareils) : GET/PUT/POST/DELETE
 * /housePreaching/follows. Les controllers sont appelés directement avec un
 * req/res construit à la main (même pattern que podcast.test.js).
 *
 * @module tests/Pelerin/housePreachingFollows.test
 */

const {
  setupPelerinTestDB,
  buildReq,
  buildRes,
  fakeUserId,
} = require('./_helpers/pelerinTestUtils');

const {
  getFollows,
  setFollows,
  addFollow,
  removeFollow,
} = require('../../dryApp/Pelerin/features/housePreaching/controller/housePreaching.controller');

describe('Pelerin — housePreaching suivis de prêcheurs', () => {
  setupPelerinTestDB();

  it('aucun suivi au départ', async () => {
    const req = buildReq({ user: { id: fakeUserId() } });
    const res = buildRes();
    await getFollows(req, res);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('suivre puis retirer un prêcheur (add/remove)', async () => {
    const user = { id: fakeUserId() };

    const addRes = buildRes();
    await addFollow(buildReq({ user, body: { preacher: 'Pasteur Yves Castanou' } }), addRes);
    expect(addRes.body.data.following).toBe(true);

    const listRes = buildRes();
    await getFollows(buildReq({ user }), listRes);
    expect(listRes.body.data).toContain('Pasteur Yves Castanou');

    const delRes = buildRes();
    await removeFollow(buildReq({ user, params: { preacher: 'Pasteur Yves Castanou' } }), delRes);
    expect(delRes.body.data.following).toBe(false);

    const emptyRes = buildRes();
    await getFollows(buildReq({ user }), emptyRes);
    expect(emptyRes.body.data).toEqual([]);
  });

  it('un prêcheur manquant est refusé à l’ajout', async () => {
    const req = buildReq({ user: { id: fakeUserId() }, body: { preacher: '   ' } });
    const res = buildRes();
    await expect(addFollow(req, res)).rejects.toThrow();
  });

  it('PUT remplace la liste complète sans doublons', async () => {
    const user = { id: fakeUserId() };

    // Doublons volontaires + noms vides → dédupliqués.
    const setRes = buildRes();
    await setFollows(
      buildReq({
        user,
        body: { preachers: ['Ps. Yves', 'Ps. Yves', '', 'Ps. Yvan', '  Ps. Yvan  '] },
      }),
      setRes,
    );
    expect(setRes.body.data).toEqual(['Ps. Yves', 'Ps. Yvan']);

    // Un second PUT avec une liste différente remplace entièrement.
    const setRes2 = buildRes();
    await setFollows(
      buildReq({ user, body: { preachers: ['Pasteur Yves Castanou'] } }),
      setRes2,
    );
    const listRes = buildRes();
    await getFollows(buildReq({ user }), listRes);
    expect(listRes.body.data).toEqual(['Pasteur Yves Castanou']);
  });

  it('les suivis sont isolés par utilisateur', async () => {
    const userA = { id: fakeUserId() };
    const userB = { id: fakeUserId() };

    await addFollow(buildReq({ user: userA, body: { preacher: 'Ps. Yves' } }), buildRes());

    const resB = buildRes();
    await getFollows(buildReq({ user: userB }), resB);
    expect(resB.body.data).toEqual([]);
  });
});
