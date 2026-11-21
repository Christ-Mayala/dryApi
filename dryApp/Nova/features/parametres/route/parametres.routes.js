const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const {
  exigerAdministrationNova,
  filtrerEspacesMiddleware,
  verifierPayloadAcces,
  exigerAccesRessource,
} = require('../../../services/acl.service');
const ParametresSchema = require('../model/parametres.schema');

// Fabrique CRUD du noyau DRY : GET /, GET /:id, POST /, PUT /:id, DELETE /:id.
// Lecture publique ; ecriture reservee au proprietaire ou a un administrateur.
module.exports = buildCrudRouter('Parametre', ParametresSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.parametres.create,
    update: validateNova.parametres.update,
  },
  middlewares: {
    list: [exigerAdministrationNova, filtrerEspacesMiddleware('espaceId')],
    get: [exigerAdministrationNova, exigerAccesRessource({ modelName: 'Parametre', schema: ParametresSchema })],
    create: [exigerAdministrationNova, verifierPayloadAcces()],
    update: [
      exigerAdministrationNova,
      exigerAccesRessource({ modelName: 'Parametre', schema: ParametresSchema, droit: 'edition' }),
      verifierPayloadAcces(),
    ],
    delete: [
      exigerAdministrationNova,
      exigerAccesRessource({ modelName: 'Parametre', schema: ParametresSchema, droit: 'edition' }),
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
