const express = require('express');
const router = express.Router();

const upload = require('../../../../../dry/services/cloudinary/cloudinary.service');
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');

const createProperty = require('../controller/property.create.controller');
const listProperties = require('../controller/property.list.controller');
const getPropertyById = require('../controller/property.get.controller');
const updateProperty = require('../controller/property.update.controller');
const deleteProperty = require('../controller/property.delete.controller');
const toggleFavori = require('../controller/property.favoris.controller');
const rateProperty = require('../controller/property.rate.controller');
const getPropertyWithRating = require('../controller/property.rating.controller');
const recordVisit = require('../controller/property.visit.controller');

router.get('/', listProperties);
router.get('/:id', getPropertyById);

router.post('/', protect, authorize('admin'), upload.array('images', 10), createProperty);
router.put('/:id', protect, authorize('admin'), upload.array('images', 10), updateProperty);
router.delete('/:id', protect, authorize('admin'), deleteProperty);

router.post('/:id/favoris', protect, toggleFavori);
router.post('/:id/rate', protect, rateProperty);
router.get('/:id/rating', protect, getPropertyWithRating);
router.post('/:id/visit', protect, recordVisit);

module.exports = router;
