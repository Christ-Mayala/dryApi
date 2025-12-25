const express = require('express');
const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');

const toggleFavori = require('../controller/favoris.toggle.controller');
const getFavoris = require('../controller/favoris.list.controller');

router.post('/:id', protect, toggleFavori);
router.get('/', protect, getFavoris);

module.exports = router;
