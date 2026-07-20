const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const listUsers = require('../controller/admin.users.list.controller');
const updateUserRole = require('../controller/admin.users.role.controller');
const updateUserStatus = require('../controller/admin.users.status.controller');
const deleteUser = require('../controller/admin.users.delete.controller');
const stats = require('../controller/admin.stats.controller');

// Tout ce module est reserve aux admins Pelerin — protege globalement, pas
// route par route (contrairement aux autres features qui melangent lecture
// publique et ecriture admin).
router.use(protect, authorize('admin'));

router.get('/stats', stats);
router.get('/users', listUsers);
router.put('/users/:id/role', validateId, withAudit('ADMIN_USER_ROLE_UPDATE'), updateUserRole);
router.put('/users/:id/status', validateId, withAudit('ADMIN_USER_STATUS_UPDATE'), updateUserStatus);
router.delete('/users/:id', validateId, withAudit('ADMIN_USER_DELETE'), deleteUser);

module.exports = router;
