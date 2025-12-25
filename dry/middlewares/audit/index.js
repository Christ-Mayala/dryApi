const auditLogger = require('./audit.middleware');

// Enveloppe DRY pour brancher facilement l'audit sur les routes sensibles.
// Exemple dans une feature :
//   const { withAudit } = require('../../../../../dry/middlewares/audit');
//   router.post('/', protect, authorize('admin'), withAudit('CREATE_PRODUCT'), create);
//
// Ici, on passe un nom d'action lisible afin de faciliter l'analyse des logs.

const withAudit = (actionName) => auditLogger(actionName);

module.exports = { withAudit };
