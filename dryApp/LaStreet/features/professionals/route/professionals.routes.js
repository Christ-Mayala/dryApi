const express = require('express');
const router = express.Router();

const upload = require('../../../../../dry/services/cloudinary/cloudinary.service');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const listProfessionals = require('../controller/professionals.list.controller');
const getProfessional = require('../controller/professionals.get.controller');
const createProfessional = require('../controller/professionals.create.controller');
const getMyProfessional = require('../controller/professionals.me.get.controller');
const updateMyProfessional = require('../controller/professionals.me.update.controller');
const recommendations = require('../controller/professionals.recommendations.controller');
const rateProfessional = require('../controller/professionals.rate.controller');

const proUpload = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'images', maxCount: 1 },
]);

router.get('/', listProfessionals);
router.get('/recommendations', recommendations);
router.get('/me', protect, withAudit('GET_MY_PROFESSIONAL'), getMyProfessional);
router.patch('/me', protect, withAudit('UPDATE_MY_PROFESSIONAL'), proUpload, updateMyProfessional);
router.post('/:id/rate', protect, withAudit('RATE_PROFESSIONAL'), rateProfessional);
router.get('/:id', getProfessional);
router.post('/', protect, withAudit('CREATE_PROFESSIONAL'), proUpload, createProfessional);

module.exports = router;
