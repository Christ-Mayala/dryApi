const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const {
  exigerEditionNova,
  filtrerEspacesMiddleware,
  verifierPayloadAcces,
  exigerAccesRessource,
} = require('../../../services/acl.service');
const ModelesSchema = require('../model/modeles.schema');

module.exports = buildCrudRouter('Modele', ModelesSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.modeles.create,
    update: validateNova.modeles.update,
  },
  middlewares: {
    list: [filtrerEspacesMiddleware('espaceId')],
    get: [exigerAccesRessource({ modelName: 'Modele', schema: ModelesSchema })],
    create: [exigerEditionNova, verifierPayloadAcces()],
    update: [
      exigerEditionNova,
      exigerAccesRessource({ modelName: 'Modele', schema: ModelesSchema, droit: 'edition' }),
      verifierPayloadAcces(),
    ],
    delete: [
      exigerEditionNova,
      exigerAccesRessource({ modelName: 'Modele', schema: ModelesSchema, droit: 'edition' }),
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
