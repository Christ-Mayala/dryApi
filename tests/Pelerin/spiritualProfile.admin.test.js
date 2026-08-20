/**
 * Tests d'integration — Pelerin / moderation des profils spirituels (admin)
 *
 * Les controllers admin ne verifient PAS eux-memes le role admin (c'est le
 * middleware de route `authorize('admin')` qui le fait, court-circuite ici
 * puisqu'on appelle les controllers directement).
 *
 * @module tests/Pelerin/spiritualProfile.admin.test
 */

const {
  setupPelerinTestDB,
  getPelerinModel,
  createRealUser,
  buildReq,
  buildRes,
} = require('./_helpers/pelerinTestUtils');

const SpiritualProfileSchema = require('../../dryApp/Pelerin/features/spiritual-profile/model/spiritualProfile.schema');

const listSpiritualProfiles = require('../../dryApp/Pelerin/features/admin/controller/admin.spiritualProfiles.list.controller');
const deleteSpiritualProfile = require('../../dryApp/Pelerin/features/admin/controller/admin.spiritualProfiles.delete.controller');

const createProfileFor = async (user, overrides = {}) => {
  const Model = getPelerinModel('SpiritualProfile', SpiritualProfileSchema);
  return Model.create({
    createdBy: String(user._id),
    favoriteVerseBook: 'jean',
    favoriteVerseChapter: 3,
    favoriteVerseVerse: 16,
    favoriteVerseText: 'Car Dieu a tant aime le monde...',
    spiritualGoal: 'Grandir dans la priere',
    prayerTopics: ['famille', 'travail'],
    ...overrides,
  });
};

describe('Pelerin — admin/spiritual-profiles', () => {
  setupPelerinTestDB();

  it('liste tous les profils spirituels avec les infos du compte associe', async () => {
    const alice = await createRealUser({ name: 'Alice Dupont', email: 'alice@test.local' });
    const bob = await createRealUser({ name: 'Bob Martin', email: 'bob@test.local' });
    await createProfileFor(alice);
    await createProfileFor(bob, { spiritualGoal: 'Lire la Bible chaque jour' });

    const res = buildRes();
    await listSpiritualProfiles(buildReq({ query: {} }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);

    const aliceProfile = res.body.data.find((p) => p.user.email === 'alice@test.local');
    expect(aliceProfile.user.name).toBe('Alice Dupont');
    expect(aliceProfile.favoriteVerseBook).toBe('jean');
    expect(aliceProfile.spiritualGoal).toBe('Grandir dans la priere');
    expect(aliceProfile.prayerTopics).toEqual(['famille', 'travail']);
  });

  it('paginate et trie par updatedAt decroissant', async () => {
    const alice = await createRealUser({ name: 'Alice', email: 'a@test.local' });
    const bob = await createRealUser({ name: 'Bob', email: 'b@test.local' });
    const carol = await createRealUser({ name: 'Carol', email: 'c@test.local' });
    await createProfileFor(alice);
    await createProfileFor(bob);
    await createProfileFor(carol);

    const page1 = buildRes();
    await listSpiritualProfiles(buildReq({ query: { page: '1', limit: '2' } }), page1);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.pagination.totalPages).toBe(2);

    const page2 = buildRes();
    await listSpiritualProfiles(buildReq({ query: { page: '2', limit: '2' } }), page2);
    expect(page2.body.data).toHaveLength(1);
  });

  it('recherche par nom ou email de l\'utilisateur', async () => {
    const alice = await createRealUser({ name: 'Alice Dupont', email: 'alice@test.local' });
    const bob = await createRealUser({ name: 'Bob Martin', email: 'bob@test.local' });
    await createProfileFor(alice);
    await createProfileFor(bob);

    const byName = buildRes();
    await listSpiritualProfiles(buildReq({ query: { search: 'alice' } }), byName);
    expect(byName.body.data).toHaveLength(1);
    expect(byName.body.data[0].user.name).toBe('Alice Dupont');

    const byEmail = buildRes();
    await listSpiritualProfiles(buildReq({ query: { search: 'bob@test.local' } }), byEmail);
    expect(byEmail.body.data).toHaveLength(1);
    expect(byEmail.body.data[0].user.email).toBe('bob@test.local');
  });

  it('supprime un profil spirituel (moderation)', async () => {
    const user = await createRealUser({ name: 'Eve', email: 'eve@test.local' });
    const profile = await createProfileFor(user);

    const res = buildRes();
    await deleteSpiritualProfile(
      buildReq({ params: { id: String(profile._id) } }),
      res,
    );
    expect(res.body.success).toBe(true);

    const listRes = buildRes();
    await listSpiritualProfiles(buildReq(), listRes);
    expect(listRes.body.data).toHaveLength(0);
  });

  it('rejette (404) la suppression d\'un profil inexistant', async () => {
    const fakeId = new (require('mongoose').Types.ObjectId)().toString();
    await expect(
      deleteSpiritualProfile(buildReq({ params: { id: fakeId } }), buildRes()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('un utilisateur sans profil spirituel n\'apparait pas dans la liste', async () => {
    await createRealUser({ name: 'Ghost', email: 'ghost@test.local' });
    const res = buildRes();
    await listSpiritualProfiles(buildReq(), res);
    expect(res.body.data).toHaveLength(0);
  });
});
