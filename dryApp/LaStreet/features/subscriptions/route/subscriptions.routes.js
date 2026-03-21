const express = require('express');
const router = express.Router();
const subscriptionsController = require('../controller/subscriptions.controller');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const upload = require('../../../../../dry/services/cloudinary/cloudinary.service');

// Routes Utilisateur
router.post('/request', protect, upload.single('proofImage'), subscriptionsController.requestSubscription);

// Routes Admin (protégées par authorize('admin'))
router.get('/admin/requests', protect, authorize('admin'), subscriptionsController.getAllSubscriptionRequests);
router.post('/admin/requests/:requestId/decision', protect, authorize('admin'), subscriptionsController.handleSubscriptionDecision);

module.exports = router;
