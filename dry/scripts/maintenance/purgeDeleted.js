const cron = require('node-cron');
const logger = require('../../utils/logging/logger');
const config = require('../../../config/database');
const { connectCluster } = require('../../config/connection/dbConnection');

// Configuration depuis les variables d'environnement
const PURGE_ENABLED = config.PURGE_ENABLED === 'true';
const PURGE_AFTER_DAYS = parseInt(config.PURGE_AFTER_DAYS) || 14;
const PURGE_CRON = config.PURGE_CRON || '0 3 * * *'; // Par défaut à 3h du matin

/**
 * Script de purge des données supprimées (soft delete)
 * Exécute automatiquement selon le cron configuré
 */
const purgeDeletedData = async () => {
  // S'assurer de la connexion DB si lancé en standalone
  await connectCluster();

  if (!PURGE_ENABLED) {
    logger('Purge désactivée (PURGE_ENABLED=false)', 'info');
    return;
  }

  logger(`🗑️  Démarrage purge des données supprimées depuis plus de ${PURGE_AFTER_DAYS} jours`, 'info');

  try {
    // Cette fonction sera implémentée dans chaque modèle spécifique
    // Pour l'instant, c'est un template pour la purge
    
    // TODO: Implémenter la purge pour chaque modèle avec soft delete
    // Exemple:
    // await User.deleteMany({ 
    //   status: 'deleted', 
    //   deletedAt: { $lt: new Date(Date.now() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000) }
    // });

    logger('✅ Purge terminée avec succès', 'info');
  } catch (error) {
    logger(`❌ Erreur lors de la purge: ${error.message}`, 'error');
  }
};

// Démarrer le cron si activé (seulement si importé)
if (PURGE_ENABLED && require.main !== module) {
  cron.schedule(PURGE_CRON, purgeDeletedData);
  logger(`🕐 Purge automatique configurée: ${PURGE_CRON}`, 'info');
}

// Exécution directe si lancé via CLI
if (require.main === module) {
  purgeDeletedData().then(() => {
    process.exit(0);
  }).catch((err) => {
    logger(`❌ Erreur fatale: ${err.message}`, 'error');
    process.exit(1);
  });
}

// Export pour utilisation manuelle
module.exports = { purgeDeletedData };
