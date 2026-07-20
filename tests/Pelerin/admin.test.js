/**
 * Tests d'integration — Pelerin / feature "admin" (gestion des utilisateurs)
 *
 * Ces controllers ne verifient PAS eux-memes le role admin (c'est le middleware
 * de route `authorize('admin')` qui le fait, court-circuite ici puisqu'on
 * appelle les controllers directement) — mais ils protegent bien contre
 * l'auto-suspension / l'auto-retrait de son propre role admin / l'auto-suppression.
 *
 * @module tests/Pelerin/admin.test
 */

const { setupPelerinTestDB, createRealUser, buildReq, buildRes } = require('./_helpers/pelerinTestUtils');

const listUsers = require('../../dryApp/Pelerin/features/admin/controller/admin.users.list.controller');
const updateUserRole = require('../../dryApp/Pelerin/features/admin/controller/admin.users.role.controller');
const updateUserStatus = require('../../dryApp/Pelerin/features/admin/controller/admin.users.status.controller');
const deleteUser = require('../../dryApp/Pelerin/features/admin/controller/admin.users.delete.controller');

describe('Pelerin — admin/users', () => {
  setupPelerinTestDB();

  it('liste les utilisateurs avec pagination et recherche par nom/email', async () => {
    await createRealUser({ name: 'Alice Dupont', email: 'alice@test.local' });
    await createRealUser({ name: 'Bob Martin', email: 'bob@test.local' });

    const listRes = buildRes();
    await listUsers(buildReq({ query: {} }), listRes);
    expect(listRes.body.data).toHaveLength(2);
    expect(listRes.body.pagination.total).toBe(2);

    const searchRes = buildRes();
    await listUsers(buildReq({ query: { search: 'alice' } }), searchRes);
    expect(searchRes.body.data).toHaveLength(1);
    expect(searchRes.body.data[0].email).toBe('alice@test.local');
  });

  it('suspend puis reactive un compte utilisateur', async () => {
    const admin = await createRealUser({ role: 'admin', email: 'admin@test.local' });
    const target = await createRealUser({ email: 'target@test.local' });

    const suspendReq = buildReq({
      user: { id: admin._id.toString() },
      params: { id: target._id.toString() },
      body: { status: 'banned' },
    });
    const suspendRes = buildRes();
    await updateUserStatus(suspendReq, suspendRes);
    expect(suspendRes.body.data.status).toBe('banned');

    const reactivateReq = buildReq({
      user: { id: admin._id.toString() },
      params: { id: target._id.toString() },
      body: { status: 'active' },
    });
    const reactivateRes = buildRes();
    await updateUserStatus(reactivateReq, reactivateRes);
    expect(reactivateRes.body.data.status).toBe('active');
  });

  it("un admin ne peut pas suspendre son propre compte", async () => {
    const admin = await createRealUser({ role: 'admin', email: 'selfsuspend@test.local' });
    const req = buildReq({
      user: { id: admin._id.toString() },
      params: { id: admin._id.toString() },
      body: { status: 'banned' },
    });
    await expect(updateUserStatus(req, buildRes())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejette un statut invalide', async () => {
    const target = await createRealUser({ email: 'invalidstatus@test.local' });
    const req = buildReq({ params: { id: target._id.toString() }, body: { status: 'not-a-status' } });
    await expect(updateUserStatus(req, buildRes())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('promeut un utilisateur au role admin', async () => {
    const admin = await createRealUser({ role: 'admin', email: 'promoter@test.local' });
    const target = await createRealUser({ email: 'promoted@test.local' });

    const req = buildReq({
      user: { id: admin._id.toString() },
      params: { id: target._id.toString() },
      body: { role: 'admin' },
    });
    const res = buildRes();
    await updateUserRole(req, res);
    expect(res.body.data.role).toBe('admin');
  });

  it("un admin ne peut pas retirer son propre role admin", async () => {
    const admin = await createRealUser({ role: 'admin', email: 'selfdemote@test.local' });
    const req = buildReq({
      user: { id: admin._id.toString() },
      params: { id: admin._id.toString() },
      body: { role: 'user' },
    });
    await expect(updateUserRole(req, buildRes())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('supprime (soft-delete) un utilisateur, absent ensuite de la liste', async () => {
    const admin = await createRealUser({ role: 'admin', email: 'deleter@test.local' });
    const target = await createRealUser({ email: 'todelete@test.local' });

    const req = buildReq({ user: { id: admin._id.toString() }, params: { id: target._id.toString() } });
    const res = buildRes();
    await deleteUser(req, res);
    expect(res.body.success).toBe(true);

    const listRes = buildRes();
    await listUsers(buildReq(), listRes);
    expect(listRes.body.data.find((u) => String(u._id) === String(target._id))).toBeUndefined();
  });

  it("un admin ne peut pas supprimer son propre compte depuis cet ecran", async () => {
    const admin = await createRealUser({ role: 'admin', email: 'selfdelete@test.local' });
    const req = buildReq({ user: { id: admin._id.toString() }, params: { id: admin._id.toString() } });
    await expect(deleteUser(req, buildRes())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejette (404) une operation sur un utilisateur inexistant', async () => {
    const fakeId = new (require('mongoose').Types.ObjectId)().toString();
    const admin = await createRealUser({ role: 'admin', email: 'admin404@test.local' });

    await expect(
      updateUserStatus(
        buildReq({ user: { id: admin._id.toString() }, params: { id: fakeId }, body: { status: 'active' } }),
        buildRes(),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
