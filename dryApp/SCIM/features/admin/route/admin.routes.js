const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');

const getDashboardStats = require('../controller/admin.dashboardStats.controller');
const getAllReservations = require('../controller/admin.reservations.list.controller');

const getAllProperties = require('../controller/admin.properties.list.controller');
const getPropertyById = require('../controller/admin.properties.get.controller');
const updatePropertyStatus = require('../controller/admin.properties.updateStatus.controller');
const deleteProperty = require('../controller/admin.properties.delete.controller');

const getAllUsers = require('../controller/admin.users.list.controller');
const getUserById = require('../controller/admin.users.get.controller');
const updateUser = require('../controller/admin.users.update.controller');
const updateUserRole = require('../controller/admin.users.updateRole.controller');
const deleteUser = require('../controller/admin.users.delete.controller');
const restoreUser = require('../controller/admin.users.restore.controller');

const getAllMessages = require('../controller/admin.messages.list.controller');
const getMessageById = require('../controller/admin.messages.get.controller');
const updateMessageStatus = require('../controller/admin.messages.updateStatus.controller');
const deleteMessage = require('../controller/admin.messages.delete.controller');

const getPropertyAnalytics = require('../controller/admin.analytics.properties.controller');
const getUserAnalytics = require('../controller/admin.analytics.users.controller');
const getRevenueAnalytics = require('../controller/admin.analytics.revenue.controller');

const getSystemSettings = require('../controller/admin.settings.get.controller');
const updateSystemSettings = require('../controller/admin.settings.update.controller');

router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard/stats', getDashboardStats);
router.get('/reservations', getAllReservations);

router.get('/properties', getAllProperties);
router.get('/properties/:id', getPropertyById);
router.put('/properties/:id/status', updatePropertyStatus);
router.delete('/properties/:id', deleteProperty);

router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/restore', restoreUser);

router.get('/messages', getAllMessages);
router.get('/messages/:id', getMessageById);
router.put('/messages/:id/status', updateMessageStatus);
router.delete('/messages/:id', deleteMessage);

router.get('/analytics/properties', getPropertyAnalytics);
router.get('/analytics/users', getUserAnalytics);
router.get('/analytics/revenue', getRevenueAnalytics);

router.get('/settings', getSystemSettings);
router.put('/settings', updateSystemSettings);

module.exports = router;
