/**
 * Tests d'integration — Pelerin / feature "notifications" (inbox).
 *
 * Vérifie que :
 *   1. l'approbation admin d'un temoignage genere une notification pour l'auteur ;
 *   2. GET /notifications ne renvoie que les notifications de l'utilisateur connecte ;
 *   3. POST /notifications/:id/read marque UNE notification comme lue (et seulement la sienne) ;
 *   4. POST /notifications/read-all marque tout comme lu ;
 *   5. la re-approbation d'un temoignage deja approuve ne cree pas de doublon.
 *
 * @module tests/Pelerin/notifications.test
 */

const { setupPelerinTestDB, buildReq, buildRes, fakeUserId } = require('./_helpers/pelerinTestUtils');

const createTemoignage = require('../../dryApp/Pelerin/features/temoignage/controller/temoignage.create.controller');
const updateTemoignage = require('../../dryApp/Pelerin/features/temoignage/controller/temoignage.update.controller');
const getMine = require('../../dryApp/Pelerin/features/notifications/controller/notifications.getMine.controller');
const markRead = require('../../dryApp/Pelerin/features/notifications/controller/notifications.markRead.controller');
const markAllRead = require('../../dryApp/Pelerin/features/notifications/controller/notifications.markAllRead.controller');

const submitPayload = {
  title: 'De la depression a la paix',
  before: 'Je me sentais perdu',
  encounter: 'J ai rencontre le Christ',
  after: 'Je vis dans la paix',
};

const approveAsAdmin = async (temoignageId) => {
  const adminReq = buildReq({
    params: { id: String(temoignageId) },
    body: { isApproved: true },
    user: { id: fakeUserId(), role: 'admin' },
  });
  return updateTemoignage(adminReq, buildRes());
};

describe('Pelerin — notifications (inbox)', () => {
  setupPelerinTestDB();

  it('approuver un temoignage genere une notification pour son auteur', async () => {
    const author = buildReq({ body: submitPayload });
    const submitRes = buildRes();
    await createTemoignage(author, submitRes);
    const temoignageId = submitRes.body.data._id;

    await approveAsAdmin(temoignageId);

    const notifRes = buildRes();
    await getMine(buildReq({ user: author.user }), notifRes);

    expect(notifRes.body.data.items.length).toBe(1);
    const n = notifRes.body.data.items[0];
    expect(n.title).toContain('publi');
    expect(n.type).toBe('temoignage');
    expect(n.read).toBe(false);
    expect(n.link).toContain(String(temoignageId));
  });

  it('chaque utilisateur ne voit que ses propres notifications', async () => {
    const author = buildReq({ body: submitPayload });
    const submitRes = buildRes();
    await createTemoignage(author, submitRes);
    await approveAsAdmin(submitRes.body.data._id);

    // Un autre utilisateur ne voit rien
    const strangerRes = buildRes();
    await getMine(buildReq(), strangerRes);
    expect(strangerRes.body.data.items.length).toBe(0);
  });

  it('marquer une notification comme lue ne touche pas aux autres', async () => {
    const author = buildReq({ body: submitPayload });
    const submitRes = buildRes();
    await createTemoignage(author, submitRes);
    await approveAsAdmin(submitRes.body.data._id);
    const temoignageId = submitRes.body.data._id;

    // Seconde notification (ré-approbation interdite par le contrôleur —
    // on en crée une via un second témoignage du MÊME auteur)
    const second = buildReq({ user: author.user, body: { ...submitPayload, title: 'Second temoignage' } });
    const secondRes = buildRes();
    await createTemoignage(second, secondRes);
    await approveAsAdmin(secondRes.body.data._id);

    const inboxRes = buildRes();
    await getMine(buildReq({ user: author.user }), inboxRes);
    expect(inboxRes.body.data.items.length).toBe(2);
    expect(inboxRes.body.data.unreadCount).toBe(2);

    const first = inboxRes.body.data.items.find((n) => n.link.includes(String(temoignageId)));
    const readRes = buildRes();
    await markRead(buildReq({ user: author.user, params: { id: first._id } }), readRes);
    expect(readRes.body.data.read).toBe(true);

    const afterRes = buildRes();
    await getMine(buildReq({ user: author.user }), afterRes);
    expect(afterRes.body.data.unreadCount).toBe(1);
  });

  it('un utilisateur ne peut pas marquer la notification d un autre comme lue', async () => {
    const author = buildReq({ body: submitPayload });
    const submitRes = buildRes();
    await createTemoignage(author, submitRes);
    await approveAsAdmin(submitRes.body.data._id);

    const inboxRes = buildRes();
    await getMine(buildReq({ user: author.user }), inboxRes);
    const first = inboxRes.body.data.items[0];

    // Un autre utilisateur tente de la lire -> 404
    const strangerRes = buildRes();
    await expect(
      markRead(buildReq({ params: { id: first._id } }), strangerRes),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('read-all marque toutes les notifications comme lues', async () => {
    const author = buildReq({ body: submitPayload });
    const submitRes = buildRes();
    await createTemoignage(author, submitRes);
    await approveAsAdmin(submitRes.body.data._id);

    const res = buildRes();
    await markAllRead(buildReq({ user: author.user }), res);

    const afterRes = buildRes();
    await getMine(buildReq({ user: author.user }), afterRes);
    expect(afterRes.body.data.unreadCount).toBe(0);
    expect(afterRes.body.data.items.every((n) => n.read)).toBe(true);
  });

  it('re-approuver un temoignage deja approuve ne cree pas de doublon', async () => {
    const author = buildReq({ body: submitPayload });
    const submitRes = buildRes();
    await createTemoignage(author, submitRes);
    const temoignageId = submitRes.body.data._id;

    await approveAsAdmin(temoignageId);
    await approveAsAdmin(temoignageId);

    const notifRes = buildRes();
    await getMine(buildReq({ user: author.user }), notifRes);
    expect(notifRes.body.data.items.length).toBe(1);
  });
});
