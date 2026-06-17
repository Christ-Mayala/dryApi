const express = require('express');
const router = express.Router();

const { push, pull, stats } = require('../controller/sync.controller');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

// --- ROUTES DE SYNCHRONISATION (toutes protégées) ---

// Push : Envoyer les modifications du client vers le serveur
router.post('/push', protect, withAudit('TRIVIDA_SYNC_PUSH'), push);

// Pull : Récupérer les modifications du serveur
router.get('/pull', protect, withAudit('TRIVIDA_SYNC_PULL'), pull);

// Stats : Obtenir les statistiques de sync
router.get('/stats', protect, withAudit('TRIVIDA_SYNC_STATS'), stats);

module.exports = router;
