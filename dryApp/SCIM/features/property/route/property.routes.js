const express = require('express');

const router = express.Router();

const upload = require('../../../../../dry/services/cloudinary/cloudinary.service');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateSCIM } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const createProperty = require('../controller/property.create.controller');
const listProperties = require('../controller/property.list.controller');
const getPropertyById = require('../controller/property.get.controller');
const updateProperty = require('../controller/property.update.controller');
const deleteProperty = require('../controller/property.delete.controller');
const createPropertySubmission = require('../controller/property.submission.create.controller');
const toggleFavori = require('../controller/property.favoris.controller');
const rateProperty = require('../controller/property.rate.controller');
const getPropertyWithRating = require('../controller/property.rating.controller');
const getUserNote = require('../controller/property.userNote.controller');
const recordVisit = require('../controller/property.visit.controller');

const propertyUpload = upload.fields([{ name: 'images', maxCount: 25 }]);
const submissionUpload = upload.fields([{ name: 'images', maxCount: 10 }]);

// Public routes
router.get('/', cache(300), listProperties);
router.post('/submissions', submissionUpload, validateSCIM.property.submissionCreate, createPropertySubmission);
router.get('/:id', validateId, cache(600), getPropertyById);

// Admin-only write routes
router.post('/', protect, authorize('admin'), withAudit('CREATE_PROPERTY'), propertyUpload, validateSCIM.property.create, invalidateCache(), createProperty);
router.put('/:id', protect, authorize('admin'), validateId, propertyUpload, validateSCIM.property.update, invalidateCache(), updateProperty);
router.delete('/:id', protect, authorize('admin'), validateId, invalidateCache(), deleteProperty);

// User routes
router.post('/:id/favoris', protect, validateId, toggleFavori);
router.post('/:id/rate', protect, validateId, validateSCIM.property.rate, rateProperty);
router.get('/:id/user-note', protect, validateId, getUserNote);
router.get('/:id/rating', protect, validateId, getPropertyWithRating);
router.post('/:id/visit', protect, validateId, recordVisit);

module.exports = router;
