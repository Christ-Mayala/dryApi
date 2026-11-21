const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const {
  exigerEditionNova,
  filtrerParBases,
  verifierPayloadAcces,
  exigerAccesRessource,
} = require('../../../services/acl.service');
const ElementsSchema = require('../model/elements.schema');

// Un élément appartient à une base, elle-même rattachée à un espace ou à une
// page. L'ACL remonte cette chaîne côté serveur.
module.exports = buildCrudRouter('Element', ElementsSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.elements.create,
    update: validateNova.elements.update,
  },
  middlewares: {
    list: [filtrerParBases({ champ: 'baseId' })],
    get: [exigerAccesRessource({ modelName: 'Element', schema: ElementsSchema })],
    create: [exigerEditionNova, verifierPayloadAcces()],
    update: [
      exigerEditionNova,
      exigerAccesRessource({ modelName: 'Element', schema: ElementsSchema, droit: 'edition' }),
      verifierPayloadAcces(),
    ],
    delete: [
      exigerEditionNova,
      exigerAccesRessource({ modelName: 'Element', schema: ElementsSchema, droit: 'edition' }),
    ],
  },
  crudOptions: {
    populateFields: 'baseId',
    transformInput: async ({ req, payload }) => {
      if (req.user?._id) {
        payload.createdBy = payload.createdBy || req.user._id;
        payload.updatedBy = req.user._id;
      }
      return payload;
    },
  },
});
