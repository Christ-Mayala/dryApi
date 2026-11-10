const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const { forcerFiltre } = require('../../../services/acl.service');
const NotificationsSchema = require('../model/notifications.schema');

/**
 * Filtre les notifications pour l'utilisateur connecté :
 * - Ses notifications individuelles (destinataireId = son id)
 * - Les notifications communes/globales (sans destinataireId ou destinataireId = null)
 */
const filtrerNotifications = (req, res, next) => {
  forcerFiltre(req, {
    $or: [
      { destinataireId: req.user._id },
      { destinataireId: null },
      { destinataireId: { $exists: false } },
    ],
  });
  next();
};

// Fabrique CRUD du noyau DRY : GET /, GET /:id, POST /, PUT /:id, DELETE /:id.
// Authentification requise pour lister, consulter et gérer ses notifications.
module.exports = buildCrudRouter('Notification', NotificationsSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.notifications.create,
    update: validateNova.notifications.update,
  },
  middlewares: {
    list: [filtrerNotifications],
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
