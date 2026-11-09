const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const EspacesSchema = require('../model/espaces.schema');

// Fabrique CRUD du noyau DRY : GET /, GET /:id, POST /, PUT /:id, DELETE /:id.
// Lecture publique ; ecriture reservee aux administrateurs.
module.exports = buildCrudRouter('Espace', EspacesSchema, {
  auth: { create: 'admin', update: 'admin', delete: 'admin' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.espaces.create,
    update: validateNova.espaces.update,
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
