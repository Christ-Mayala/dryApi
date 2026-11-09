const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const ParametresSchema = require('../model/parametres.schema');

// Fabrique CRUD du noyau DRY : GET /, GET /:id, POST /, PUT /:id, DELETE /:id.
// Lecture publique ; ecriture reservee aux administrateurs.
module.exports = buildCrudRouter('Parametre', ParametresSchema, {
  auth: { create: 'admin', update: 'admin', delete: 'admin' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.parametres.create,
    update: validateNova.parametres.update,
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
