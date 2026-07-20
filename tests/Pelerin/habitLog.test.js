/**
 * Tests d'integration — Pelerin / features "habit" + "habitLog"
 *
 * Couvre : CRUD habit basique, scoping par createdBy, et la propriete
 * d'idempotence du toggle (Property 16 / Requirement 17.5) : cocher deux fois
 * la meme habitude au meme jour doit revenir a l'etat initial
 * (toggle(toggle(x)) == x), pas s'accumuler.
 *
 * @module tests/Pelerin/habitLog.test
 */

const {
  setupPelerinTestDB,
  getPelerinModel,
  buildReq,
  buildRes,
} = require('./_helpers/pelerinTestUtils');

const HabitSchema = require('../../dryApp/Pelerin/features/habit/model/habit.schema');
const HabitLogSchema = require('../../dryApp/Pelerin/features/habitLog/model/habitLog.schema');

const createHabit = require('../../dryApp/Pelerin/features/habit/controller/habit.create.controller');
const updateHabit = require('../../dryApp/Pelerin/features/habit/controller/habit.update.controller');
const deleteHabit = require('../../dryApp/Pelerin/features/habit/controller/habit.delete.controller');
const getAllHabit = require('../../dryApp/Pelerin/features/habit/controller/habit.getAll.controller');

const toggleHabitLog = require('../../dryApp/Pelerin/features/habitLog/controller/habitLog.toggle.controller');
const getAllHabitLog = require('../../dryApp/Pelerin/features/habitLog/controller/habitLog.getAll.controller');

describe('Pelerin — habit + habitLog', () => {
  setupPelerinTestDB();

  describe('habit CRUD', () => {
    it('cree une habitude avec des valeurs par defaut sensees', async () => {
      const req = buildReq({ body: { title: 'Lire la Bible chaque jour' } });
      const res = buildRes();
      await createHabit(req, res);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Lire la Bible chaque jour');
      expect(res.body.data.frequency).toBe('daily');
      expect(res.body.data.isActive).toBe(true);
    });

    it('met a jour une habitude existante (scoping createdBy)', async () => {
      const req = buildReq({ body: { title: 'Prier le matin' } });
      const res = buildRes();
      await createHabit(req, res);
      const habit = res.body.data;

      const updateReq = buildReq({
        user: req.user,
        params: { id: String(habit._id) },
        body: { title: 'Prier chaque matin', isActive: false },
      });
      const updateRes = buildRes();
      await updateHabit(updateReq, updateRes);

      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.title).toBe('Prier chaque matin');
      expect(updateRes.body.data.isActive).toBe(false);
    });

    it("un utilisateur B ne peut pas mettre a jour l'habitude de l'utilisateur A", async () => {
      const reqA = buildReq({ body: { title: 'Habitude de A' } });
      const resA = buildRes();
      await createHabit(reqA, resA);
      const habit = resA.body.data;

      const reqB = buildReq({ params: { id: String(habit._id) }, body: { title: 'Piratee' } });
      const resB = buildRes();
      await expect(updateHabit(reqB, resB)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('supprime (soft-delete) une habitude : elle disparait de getAll', async () => {
      const req = buildReq({ body: { title: 'A supprimer' } });
      const res = buildRes();
      await createHabit(req, res);
      const habit = res.body.data;

      const deleteReq = buildReq({ user: req.user, params: { id: String(habit._id) } });
      const deleteRes = buildRes();
      await deleteHabit(deleteReq, deleteRes);
      expect(deleteRes.body.success).toBe(true);

      const listReq = buildReq({ user: req.user });
      const listRes = buildRes();
      await getAllHabit(listReq, listRes);
      expect(listRes.body.data.find((h) => String(h._id) === String(habit._id))).toBeUndefined();
    });
  });

  describe('habitLog.toggle — idempotence (Property 16 / Requirement 17.5)', () => {
    const DATE = '2026-07-13';

    it('un premier toggle coche le jour (cree un log), done=true', async () => {
      const req = buildReq({ body: { title: 'Mediter' } });
      const res = buildRes();
      await createHabit(req, res);
      const habit = res.body.data;

      const toggleReq = buildReq({ user: req.user, body: { habitId: String(habit._id), date: DATE } });
      const toggleRes = buildRes();
      await toggleHabitLog(toggleReq, toggleRes);

      expect(toggleRes.body.success).toBe(true);
      expect(toggleRes.body.data.done).toBe(true);

      const LogModel = getPelerinModel('HabitLog', HabitLogSchema);
      const logs = await LogModel.find({ createdBy: req.user.id, habitId: habit._id, date: DATE });
      expect(logs).toHaveLength(1);
    });

    it('togglé deux fois de suite revient exactement a l etat initial (toggle(toggle(x)) == x)', async () => {
      const req = buildReq({ body: { title: 'Jeuner' } });
      const res = buildRes();
      await createHabit(req, res);
      const habit = res.body.data;

      const LogModel = getPelerinModel('HabitLog', HabitLogSchema);

      // Etat initial : aucun log
      const before = await LogModel.find({ createdBy: req.user.id, habitId: habit._id, date: DATE });
      expect(before).toHaveLength(0);

      const toggle = async () => {
        const toggleReq = buildReq({ user: req.user, body: { habitId: String(habit._id), date: DATE } });
        const toggleRes = buildRes();
        await toggleHabitLog(toggleReq, toggleRes);
        return toggleRes.body.data.done;
      };

      const firstDone = await toggle();
      expect(firstDone).toBe(true);
      const secondDone = await toggle();
      expect(secondDone).toBe(false);

      // Retour exact a l'etat initial : zero log, comme avant tout toggle
      const after = await LogModel.find({ createdBy: req.user.id, habitId: habit._id, date: DATE });
      expect(after).toHaveLength(0);
    });

    it('togglé trois fois laisse le jour coche (etat = un seul toggle), pas d accumulation', async () => {
      const req = buildReq({ body: { title: 'Lire un psaume' } });
      const res = buildRes();
      await createHabit(req, res);
      const habit = res.body.data;

      const toggle = async () => {
        const toggleReq = buildReq({ user: req.user, body: { habitId: String(habit._id), date: DATE } });
        const toggleRes = buildRes();
        await toggleHabitLog(toggleReq, toggleRes);
        return toggleRes.body.data.done;
      };

      await toggle(); // done=true
      await toggle(); // done=false
      const thirdDone = await toggle(); // done=true
      expect(thirdDone).toBe(true);

      const LogModel = getPelerinModel('HabitLog', HabitLogSchema);
      const logs = await LogModel.find({ createdBy: req.user.id, habitId: habit._id, date: DATE });
      expect(logs).toHaveLength(1);
    });

    it("le toggle est refuse (404) si l'habitude n'appartient pas a l'utilisateur", async () => {
      const reqA = buildReq({ body: { title: 'Habitude privee de A' } });
      const resA = buildRes();
      await createHabit(reqA, resA);
      const habit = resA.body.data;

      const reqB = buildReq({ body: { habitId: String(habit._id), date: DATE } });
      const resB = buildRes();
      await expect(toggleHabitLog(reqB, resB)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('habitLog.getAll ne renvoie que l historique du user courant, filtre par habitId', async () => {
      const req = buildReq({ body: { title: 'Louer' } });
      const res = buildRes();
      await createHabit(req, res);
      const habit = res.body.data;

      await toggleHabitLog(
        buildReq({ user: req.user, body: { habitId: String(habit._id), date: '2026-07-10' } }),
        buildRes(),
      );
      await toggleHabitLog(
        buildReq({ user: req.user, body: { habitId: String(habit._id), date: '2026-07-11' } }),
        buildRes(),
      );

      const listReq = buildReq({ user: req.user, query: { habitId: String(habit._id) } });
      const listRes = buildRes();
      await getAllHabitLog(listReq, listRes);

      expect(listRes.body.data).toHaveLength(2);
      expect(listRes.body.data.map((l) => l.date).sort()).toEqual(['2026-07-10', '2026-07-11']);
    });
  });
});
