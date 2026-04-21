const express = require('express');
const router = express.Router();
const leadsController = require('../controller/leads.controller');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const upload = require('../../../../../dry/services/cloudinary/cloudinary.service');

// Toutes les routes sont protégées

router.post('/', protect, leadsController.createLead);
router.get('/', protect, leadsController.getLeads);
router.get('/:leadId', protect, leadsController.getLeadById);
router.post('/respond', protect, leadsController.respondToLead);
router.post('/assign', protect, leadsController.assignLead);
router.post('/unlock', protect, upload.single('proofImage'), leadsController.requestLeadUnlock);
router.delete('/:leadId', protect, leadsController.deleteLead);

module.exports = router;
