const express = require('express');
const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const deleteAccount = require('../controller/account.delete.controller');

// Self-service uniquement (jamais admin sur un autre compte — voir
// dryApp/Pelerin/features/admin pour la suppression par un admin).
router.delete('/', protect, withAudit('ACCOUNT_DELETE_SELF'), deleteAccount);

module.exports = router;
