/**
 * Helpers partages pour les tests d'integration Pelerin.
 *
 * Reprend le pattern etabli dans tests/dry/mongoose.plugin.test.js (MongoMemoryServer +
 * mongoose.connect global) combine a celui de tests/unit/factories/crudFactory.test.js
 * (appel direct des controllers avec un req/res construits a la main).
 *
 * Comme les controllers Pelerin sont deja des fonctions asyncHandler(async (req, res) => {...})
 * et que express-async-handler utilise le DERNIER argument recu comme `next`
 * (voir node_modules/express-async-handler/index.js), les appeler avec seulement
 * (req, res) fait que les erreurs jetees via httpError() se propagent comme un rejet
 * de promesse normal (le `.catch(next)` ne fait rien car `next` = res, qui n'est pas
 * une fonction) : on peut donc simplement faire `await expect(controller(req, res)).rejects...`
 * sans avoir a mocker express-async-handler.
 *
 * @module tests/Pelerin/_helpers/pelerinTestUtils
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const getModel = require('../../../dry/core/factories/modelFactory');

const APP = 'Pelerin';

/**
 * A appeler a l'interieur d'un describe(): demarre un MongoMemoryServer et connecte
 * mongoose dessus avant tous les tests du fichier, vide la base "PelerinDB" apres
 * chaque test (isolation), et coupe tout a la fin.
 */
function setupPelerinTestDB() {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    const db = mongoose.connection.useDb(`${APP}DB`, { useCache: true });
    await db.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });
}

/** Equivalent de req.getModel(modelName, schema) tel que fourni par le tenant Pelerin. */
const getPelerinModel = (modelName, schema) => getModel(APP, modelName, schema);

/** Construit un faux req.user (id uniquement, comme la plupart des controllers Pelerin le lisent). */
const fakeUserId = () => new mongoose.Types.ObjectId().toString();

/** Cree un vrai document User en base (utile pour admin/users, populate createdBy...). */
const createRealUser = async (overrides = {}) => {
  const UserModel = getPelerinModel('User');
  const user = await UserModel.create({
    name: overrides.name || 'Test User',
    email: overrides.email || `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
    role: overrides.role || 'user',
    ...overrides,
  });
  return user;
};

/** Construit un req minimal pour appeler un controller Pelerin directement. */
const buildReq = (overrides = {}) => ({
  user: { id: fakeUserId() },
  params: {},
  query: {},
  body: {},
  getModel: getPelerinModel,
  ...overrides,
});

/** Construit un res mock qui capture status()/json() (res.body, res.statusCode). */
const buildRes = () => {
  const res = { locals: {} };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });
  return res;
};

module.exports = {
  APP,
  setupPelerinTestDB,
  getPelerinModel,
  fakeUserId,
  createRealUser,
  buildReq,
  buildRes,
};
