const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const {
  exigerEditionNova,
  filtrerParPages,
  verifierPayloadAcces,
  exigerAccesRessource,
} = require('../../../services/acl.service');
const BlocsSchema = require('../model/blocs.schema');

// Un bloc appartient à la page qui le contient : l'accès est dérivé de la page,
// jamais d'un identifiant fourni par le client.
module.exports = buildCrudRouter('Bloc', BlocsSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.blocs.create,
    update: validateNova.blocs.update,
  },
  middlewares: {
    list: [filtrerParPages()],
    get: [exigerAccesRessource({ modelName: 'Bloc', schema: BlocsSchema })],
    create: [
      exigerEditionNova,
      verifierPayloadAcces({ references: { parentId: 'Bloc' }, exigerReference: true }),
    ],
    update: [
      exigerEditionNova,
      exigerAccesRessource({ modelName: 'Bloc', schema: BlocsSchema, droit: 'edition' }),
      verifierPayloadAcces({ references: { parentId: 'Bloc' }, exigerReference: true }),
    ],
    delete: [
      exigerEditionNova,
      exigerAccesRessource({ modelName: 'Bloc', schema: BlocsSchema, droit: 'edition' }),
    ],
  },
  crudOptions: {
    populateFields: '',
    transformInput: async ({ req, payload }) => {
      if (req.user?._id) {
        payload.createdBy = payload.createdBy || req.user._id;
        payload.updatedBy = req.user._id;
      }
      return payload;
    },
  },
});
