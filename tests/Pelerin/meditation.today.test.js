/**
 * Tests d'intégration — Pelerin / controller meditation.today (cycling quotidien).
 *
 * Vérifie que l'endpoint /meditation/today ne renvoie PAS toujours la même
 * méditation (bug du sort=-publishDate) mais une méditation qui TOURNE selon la
 * date : même jour → même résultat, jours différents → méditation suivante dans
 * l'ordre de publication, en boucle modulo le nombre de méditations.
 */

const {
  setupPelerinTestDB,
  getPelerinModel,
  buildReq,
  buildRes,
} = require('./_helpers/pelerinTestUtils');

const MeditationSchema = require('../../dryApp/Pelerin/features/meditation/model/meditation.schema');
const todayController = require('../../dryApp/Pelerin/features/meditation/controller/meditation.today.controller');

const EPOCH_MS = new Date('2025-01-01T00:00:00.000Z').getTime();
const DAY_MS = 86_400_000;

const seedMeditations = async () => {
  const Model = getPelerinModel('Meditation', MeditationSchema);
  await Model.create([
    { title: 'M1', bookCode: 'genese', chapter: 1, verseStart: 1, reflection: 'r1', prayer: 'p1', publishDate: new Date('2025-01-01T00:00:00.000Z') },
    { title: 'M2', bookCode: 'genese', chapter: 2, verseStart: 1, reflection: 'r2', prayer: 'p2', publishDate: new Date('2025-01-02T00:00:00.000Z') },
    { title: 'M3', bookCode: 'genese', chapter: 3, verseStart: 1, reflection: 'r3', prayer: 'p3', publishDate: new Date('2025-01-03T00:00:00.000Z') },
  ]);
};

describe('Pelerin — meditation.today (cycling quotidien)', () => {
  setupPelerinTestDB();

  let dateSpy;
  beforeEach(() => {
    // On mock Date.now uniquement autour du controller, sans touches Mongo.
    dateSpy = jest.spyOn(Date, 'now').mockReturnValue(EPOCH_MS);
  });
  afterEach(() => {
    dateSpy.mockRestore();
  });

  it('renvoie 404 quand aucune méditation n’est disponible', async () => {
    await expect(todayController(buildReq(), buildRes())).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('renvoie une méditation par jour, dans l’ordre de publication, en boucle', async () => {
    await seedMeditations();
    const Model = getPelerinModel('Meditation', MeditationSchema);
    const titles = ['M1', 'M2', 'M3'];

    // Jour 0 → M1, jour 1 → M2, jour 2 → M3, jour 3 → M1 (cycle), jour 4 → M2.
    const expectedDays = [0, 1, 2, 3, 4];
    const results = [];
    for (const d of expectedDays) {
      dateSpy.mockReturnValue(EPOCH_MS + d * DAY_MS + 12 * 3_600_000);
      const res = buildRes();
      await todayController(buildReq(), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      results.push(res.body.data.title);
    }
    // Rotation : M1, M2, M3, M1, M2
    expect(results).toEqual(['M1', 'M2', 'M3', 'M1', 'M2']);
    expect(new Set(results).size).toBe(3);
    // Sanity : la DB contient bien les 3 méditations.
    expect(await Model.countDocuments({})).toBe(3);
  });

  it('est déterministe : même jour donne toujours la même méditation', async () => {
    await seedMeditations();
    const dayMs = EPOCH_MS + 5 * DAY_MS + 9 * 3_600_000;
    dateSpy.mockReturnValue(dayMs);

    const res1 = buildRes();
    await todayController(buildReq(), res1);
    const res2 = buildRes();
    await todayController(buildReq(), res2);

    expect(res1.body.data._id.toString()).toBe(res2.body.data._id.toString());
  });
});
