const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const sendResponse = require('../../../../../dry/utils/http/response');
const {
  estAdminNova,
  forcerFiltre,
  forcerProprietaire,
  exigerAccesRessource,
} = require('../../../services/acl.service');
const NotificationsSchema = require('../model/notifications.schema');

/** Ses notifications personnelles + les notifications globales. */
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

/**
 * Un membre ne peut créer que ses propres notifications. Un administrateur NOVA
 * peut envoyer une notification globale en passant explicitement `null`.
 */
const forcerDestinataire = (req, res, next) => {
  const destinataire = req.body?.destinataireId;
  if (estAdminNova(req) && (destinataire === null || destinataire === '')) {
    req.body = { ...(req.body || {}), destinataireId: null };
    return next();
  }
  if (destinataire && String(destinataire) !== String(req.user._id)) {
    return sendResponse(res, null, 'Destinataire non autorisé', false, undefined, 403);
  }
  return forcerProprietaire('destinataireId')(req, res, next);
};

const accesNotification = {
  modelName: 'Notification',
  schema: NotificationsSchema,
  proprieteProprietaire: 'destinataireId',
  autoriserSansProprietaire: true,
};

/** Une notification globale n'est modifiable/supprimable que par un admin. */
const verifierNotificationGlobale = (req, res, next) => {
  if (!req.novaRessource?.destinataireId && !estAdminNova(req)) {
    return sendResponse(res, null, 'Notification globale réservée aux administrateurs', false, undefined, 403);
  }
  return next();
};

module.exports = buildCrudRouter('Notification', NotificationsSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.notifications.create,
    update: validateNova.notifications.update,
  },
  middlewares: {
    list: [filtrerNotifications],
    get: [exigerAccesRessource(accesNotification)],
    create: [forcerDestinataire],
    update: [
      exigerAccesRessource({ ...accesNotification, droit: 'edition' }),
      verifierNotificationGlobale,
      forcerDestinataire,
    ],
    delete: [
      exigerAccesRessource({ ...accesNotification, droit: 'edition' }),
      verifierNotificationGlobale,
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
