/**
 * Tests d'integration — Pelerin / feature "notes"
 *
 * Couvre : create -> getById -> update (y compris le conflit last-write-wins
 * clientUpdatedAt) -> delete (soft, recursif sur les enfants) -> isolation
 * utilisateur (createdBy scoping, Requirement 15.1 / Property 14).
 *
 * @module tests/Pelerin/notes.test
 */

const {
  setupPelerinTestDB,
  getPelerinModel,
  buildReq,
  buildRes,
  createRealUser,
} = require('./_helpers/pelerinTestUtils');

const NotesSchema = require('../../dryApp/Pelerin/features/notes/model/notes.schema');
const createNote = require('../../dryApp/Pelerin/features/notes/controller/notes.create.controller');
const getByIdNote = require('../../dryApp/Pelerin/features/notes/controller/notes.getById.controller');
const updateNote = require('../../dryApp/Pelerin/features/notes/controller/notes.update.controller');
const deleteNote = require('../../dryApp/Pelerin/features/notes/controller/notes.delete.controller');
const getAllNotes = require('../../dryApp/Pelerin/features/notes/controller/notes.getAll.controller');

describe('Pelerin — notes', () => {
  setupPelerinTestDB();

  describe('create -> getById -> update -> delete', () => {
    it('cree une note avec le proprietaire courant', async () => {
      const req = buildReq({ body: { title: 'Ma premiere note', content: 'Contenu libre' } });
      const res = buildRes();

      await createNote(req, res);

      expect(res.status).toHaveBeenCalledWith(200); // sendResponse fixe toujours un status explicite (200 par defaut)
      expect(res.json).toHaveBeenCalled();
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Ma premiere note');
      expect(res.body.data.type).toBe('document');
      expect(String(res.body.data.createdBy._id || res.body.data.createdBy)).toBe(req.user.id);
    });

    it('recupere la note via getById', async () => {
      const req = buildReq({ body: { title: 'Note recuperable' } });
      const res = buildRes();
      await createNote(req, res);
      const noteId = res.body.data._id;

      const getReq = buildReq({ user: req.user, params: { id: String(noteId) } });
      const getRes = buildRes();
      await getByIdNote(getReq, getRes);

      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.title).toBe('Note recuperable');
    });

    it('met a jour normalement quand clientUpdatedAt est absent ou plus recent', async () => {
      const req = buildReq({ body: { title: 'Titre original' } });
      const res = buildRes();
      await createNote(req, res);
      const note = res.body.data;

      const updateReq = buildReq({
        user: req.user,
        params: { id: String(note._id) },
        body: { title: 'Titre modifie' },
      });
      const updateRes = buildRes();
      await updateNote(updateReq, updateRes);

      expect(updateRes.statusCode ?? 200).not.toBe(409);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.title).toBe('Titre modifie');
    });

    it('rejette (409) une mise a jour basee sur un clientUpdatedAt plus ancien que le serveur (conflit last-write-wins)', async () => {
      const req = buildReq({ body: { title: 'Titre serveur' } });
      const res = buildRes();
      await createNote(req, res);
      const note = res.body.data;

      // clientUpdatedAt anterieur a la creation -> forcement plus vieux que note.updatedAt
      const staleClientDate = new Date(new Date(note.updatedAt).getTime() - 60_000).toISOString();

      const updateReq = buildReq({
        user: req.user,
        params: { id: String(note._id) },
        body: { title: 'Ecrasement tente', clientUpdatedAt: staleClientDate },
      });
      const updateRes = buildRes();
      await updateNote(updateReq, updateRes);

      expect(updateRes.status).toHaveBeenCalledWith(409);
      expect(updateRes.body.success).toBe(false);
      // Le serveur renvoie SA version actuelle, pas celle ecrasee par le client
      expect(updateRes.body.data.title).toBe('Titre serveur');

      // Verifie que le titre en base n'a bien pas ete ecrase
      const Model = getPelerinModel('Notes', NotesSchema);
      const stillOriginal = await Model.findById(note._id);
      expect(stillOriginal.title).toBe('Titre serveur');
    });

    it('accepte la mise a jour quand clientUpdatedAt == updatedAt courant (pas strictement plus ancien)', async () => {
      const req = buildReq({ body: { title: 'Titre pour egalite' } });
      const res = buildRes();
      await createNote(req, res);
      const note = res.body.data;

      const updateReq = buildReq({
        user: req.user,
        params: { id: String(note._id) },
        body: { title: 'Mise a jour concurrente egale', clientUpdatedAt: note.updatedAt },
      });
      const updateRes = buildRes();
      await updateNote(updateReq, updateRes);

      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.title).toBe('Mise a jour concurrente egale');
    });

    it('supprime (soft-delete) la note : elle disparait de getById/getAll ensuite', async () => {
      const req = buildReq({ body: { title: 'A supprimer' } });
      const res = buildRes();
      await createNote(req, res);
      const note = res.body.data;

      const deleteReq = buildReq({ user: req.user, params: { id: String(note._id) } });
      const deleteRes = buildRes();
      await deleteNote(deleteReq, deleteRes);
      expect(deleteRes.body.success).toBe(true);

      // getById ne la trouve plus (soft-delete filtre par le plugin DRY)
      const getReq = buildReq({ user: req.user, params: { id: String(note._id) } });
      const getRes = buildRes();
      await expect(getByIdNote(getReq, getRes)).rejects.toMatchObject({ statusCode: 404 });

      // Le document existe toujours en base mais avec status='deleted'
      const Model = getPelerinModel('Notes', NotesSchema);
      const raw = await Model.findOne({ _id: note._id, includeDeleted: true });
      expect(raw.status).toBe('deleted');
    });

    it('la suppression d un dossier supprime recursivement ses notes enfants', async () => {
      const req = buildReq({ body: { title: 'Dossier parent', type: 'folder' } });
      const res = buildRes();
      await createNote(req, res);
      const folder = res.body.data;

      const childReq = buildReq({
        user: req.user,
        body: { title: 'Enfant', parentId: String(folder._id) },
      });
      const childRes = buildRes();
      await createNote(childReq, childRes);
      const child = childRes.body.data;

      const deleteReq = buildReq({ user: req.user, params: { id: String(folder._id) } });
      const deleteRes = buildRes();
      await deleteNote(deleteReq, deleteRes);
      expect(deleteRes.body.success).toBe(true);

      const Model = getPelerinModel('Notes', NotesSchema);
      const childRaw = await Model.findOne({ _id: child._id, includeDeleted: true });
      expect(childRaw.status).toBe('deleted');
    });
  });

  describe('isolation utilisateur (createdBy scoping — Requirement 15.1 / Property 14)', () => {
    it('un utilisateur B ne peut pas lire (getById) la note de l utilisateur A', async () => {
      const reqA = buildReq({ body: { title: 'Note privee de A' } });
      const resA = buildRes();
      await createNote(reqA, resA);
      const note = resA.body.data;

      const reqB = buildReq({ params: { id: String(note._id) } }); // nouveau user.id genere par buildReq
      const resB = buildRes();

      await expect(getByIdNote(reqB, resB)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('un utilisateur B ne peut pas modifier (update) la note de l utilisateur A', async () => {
      const reqA = buildReq({ body: { title: 'Note de A' } });
      const resA = buildRes();
      await createNote(reqA, resA);
      const note = resA.body.data;

      const reqB = buildReq({
        params: { id: String(note._id) },
        body: { title: 'Piratee par B' },
      });
      const resB = buildRes();

      await expect(updateNote(reqB, resB)).rejects.toMatchObject({ statusCode: 404 });

      // Le titre original de A n'a pas bouge
      const Model = getPelerinModel('Notes', NotesSchema);
      const stillA = await Model.findById(note._id);
      expect(stillA.title).toBe('Note de A');
    });

    it('un utilisateur B ne peut pas supprimer la note de l utilisateur A', async () => {
      const reqA = buildReq({ body: { title: 'Note de A a proteger' } });
      const resA = buildRes();
      await createNote(reqA, resA);
      const note = resA.body.data;

      const reqB = buildReq({ params: { id: String(note._id) } });
      const resB = buildRes();
      await expect(deleteNote(reqB, resB)).rejects.toMatchObject({ statusCode: 404 });

      const Model = getPelerinModel('Notes', NotesSchema);
      const stillActive = await Model.findById(note._id);
      expect(stillActive.status).toBe('active');
    });

    it('getAll ne renvoie que les notes du user courant', async () => {
      const userA = await createRealUser({ email: 'a@test.local' });
      const userB = await createRealUser({ email: 'b@test.local' });
      const reqA = buildReq({ user: { id: userA._id.toString() }, body: { title: 'Note A1' } });
      await createNote(reqA, buildRes());
      await createNote(buildReq({ user: reqA.user, body: { title: 'Note A2' } }), buildRes());

      const reqB = buildReq({ user: { id: userB._id.toString() }, body: { title: 'Note B1' } });
      await createNote(reqB, buildRes());

      const listReqA = buildReq({ user: reqA.user, query: {} });
      const listResA = buildRes();
      await getAllNotes(listReqA, listResA);

      expect(listResA.body.data).toHaveLength(2);
      expect(
        listResA.body.data.every((n) => String(n.createdBy?._id || n.createdBy) === reqA.user.id),
      ).toBe(true);
    });
  });
});
