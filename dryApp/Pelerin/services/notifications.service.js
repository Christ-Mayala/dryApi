/**
 * Service de notifications (inbox) — Pelerin.
 *
 * createNotification() est le point d'entrée unique pour générer une
 * notification depuis un événement réel du backend (témoignage approuvé,
 * nouvelle prédication publiée…). Il crée le document Notification et, si un
 * pushToken est enregistré, signale l'événement pour l'envoi push (le canal
 * push réel peut être branché ici plus tard, sans changer les appelants).
 *
 * L'API inbox : GET /notifications (liste), POST /notifications/:id/read,
 * POST /notifications/read-all — voir les contrôleurs du même dossier.
 */

const NotificationSchema = require('../features/notifications/model/notification.schema');

const NOTIFICATION_APP = 'Pelerin';

/**
 * Crée une notification pour un utilisateur.
 *
 * @param {object} opts
 * @param {string} opts.userId        — destinataire (createdBy)
 * @param {string} opts.title
 * @param {string} [opts.body]
 * @param {'verse'|'habit'|'parcours'|'temoignage'|'preaching'|'system'} [opts.type='system']
 * @param {string} [opts.link]        — route expo-router de destination
 * @param {Function} [opts.getModel]  — req.getModel si disponible (recommandé)
 * @returns {Promise<object|null>}    — document créé, ou null si échec
 */
async function createNotification({ userId, title, body = '', type = 'system', link = '', getModel }) {
  if (!userId || !title) return null;
  try {
    const Model = getModel
      ? getModel('Notification', NotificationSchema)
      : require('../../../dry/core/factories/modelFactory')(NOTIFICATION_APP, 'Notification', NotificationSchema);
    return await Model.create({ createdBy: userId, title, body, type, link });
  } catch (err) {
    console.error('[NOTIFICATION] ❌ Création échouée:', err.message);
    return null;
  }
}

module.exports = { createNotification, NOTIFICATION_APP };
