const logger = require('../../../../../dry/utils/logging/logger');

/**
 * Indique si les notifications par e-mail sont activées pour l'espace de
 * travail. Le réglage `notifEmail` de la section Paramètres est lu ici afin
 * qu'il ait un effet réel sur les envois (invitations membres / publications).
 *
 * En l'absence de configuration, les notifications sont considérées actives.
 *
 * @param {import('express').Request} req
 * @returns {Promise<boolean>}
 */
async function notificationsEmailActives(req) {
  try {
    const Parametre = req.getModel('Parametre');
    const parametre = await Parametre.findOne().sort('createdAt').lean();
    if (!parametre) return true;
    return parametre.notifEmail !== false;
  } catch (e) {
    logger(`[Nova] Lecture du réglage notifEmail impossible: ${e.message}`, 'warning');
    return true;
  }
}

module.exports = { notificationsEmailActives };
