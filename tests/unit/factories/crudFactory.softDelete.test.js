jest.mock('express-async-handler', () => (fn) => fn);
jest.mock('../../../dry/utils/http/response');
jest.mock('../../../dry/utils/logging/logger');

const sendResponse = require('../../../dry/utils/http/response');
const logger = require('../../../dry/utils/logging/logger');
const { buildCrudHandlers } = require('../../../dry/core/factories/crudFactory');

const schema = {
  path: jest.fn((champ) => (champ === 'status' ? { instance: 'String' } : undefined)),
};

function contexte(req = {}) {
  const Model = {
    findByIdAndDelete: jest.fn(async () => ({ _id: 'doc1' })),
    findOneAndUpdate: jest.fn(async () => ({ _id: 'doc1', status: 'deleted' })),
  };
  return {
    Model,
    req: {
      params: { id: 'doc1' },
      body: {},
      query: {},
      user: { _id: 'user1' },
      getModel: jest.fn(() => Model),
      ...req,
    },
    res: {},
  };
}

describe('crudFactory — suppression logique et effets async', () => {
  beforeEach(() => jest.clearAllMocks());

  it('archive le document au lieu de le supprimer physiquement', async () => {
    const { req, res, Model } = contexte();
    const handlers = buildCrudHandlers('Page', schema);

    await handlers.deleteOne(req, res);

    expect(Model.findByIdAndDelete).not.toHaveBeenCalled();
    expect(Model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'doc1', status: { $ne: 'deleted' } },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'deleted', updatedBy: 'user1' }),
      }),
      expect.any(Object)
    );
    expect(sendResponse).toHaveBeenCalled();
  });

  it('n’autorise la purge que si la route l’a explicitement permise', async () => {
    const { req, res, Model } = contexte({ query: { includeDeleted: 'true' } });
    const handlers = buildCrudHandlers('Page', schema);

    await handlers.deleteOne(req, res);

    expect(Model.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('exécute une purge uniquement après autorisation explicite', async () => {
    const { req, res, Model } = contexte({ query: { includeDeleted: 'true' } });
    req.allowPermanentDelete = true;
    const handlers = buildCrudHandlers('Page', schema);

    await handlers.deleteOne(req, res);

    expect(Model.findByIdAndDelete).toHaveBeenCalledWith('doc1', { includeDeleted: true });
  });

  it('exécute afterDelete après la suppression logique', async () => {
    const { req, res } = contexte();
    const effet = jest.fn(async () => {});
    const handlers = buildCrudHandlers('Membre', schema, { afterDelete: effet });

    await handlers.deleteOne(req, res);

    expect(effet).toHaveBeenCalledTimes(1);
    expect(effet).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        doc: expect.objectContaining({ _id: 'doc1' }),
        suppressionDéfinitive: false,
      })
    );
  });

  it('attend l’effet afterCreate et journalise ses échecs', async () => {
    const { req, res } = contexte();
    req.getModel = jest.fn(() => ({ create: jest.fn(async () => ({ _id: 'doc1' })) }));
    const effet = jest.fn().mockRejectedValue(new Error('email indisponible'));
    const handlers = buildCrudHandlers('Notification', schema, { afterCreate: effet });

    await handlers.createOne(req, res);

    expect(effet).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('"statut":"echec"'), 'error');
    expect(sendResponse).toHaveBeenCalled();
  });

  it('propage un effet critique afterCreate au lieu de répondre succès', async () => {
    const { req, res } = contexte();
    req.getModel = jest.fn(() => ({ create: jest.fn(async () => ({ _id: 'doc1' })) }));
    const effet = jest.fn().mockRejectedValue(new Error('appartenance manquante'));
    const handlers = buildCrudHandlers('Workspace', schema, {
      afterCreate: effet,
      effetsCritiques: ['afterCreate'],
    });

    await expect(handlers.createOne(req, res)).rejects.toThrow('appartenance manquante');

    expect(effet).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('"statut":"echec"'), 'error');
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
