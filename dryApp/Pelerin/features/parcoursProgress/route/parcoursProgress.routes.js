const express = require('express');
const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const getAll = require('../controller/parcoursProgress.getAll.controller');
const getOne = require('../controller/parcoursProgress.getOne.controller');
const completeStep = require('../controller/parcoursProgress.completeStep.controller');

router.use(protect);

router.get('/', getAll);
router.get('/:parcoursId', getOne);
router.post('/:parcoursId/complete-step', withAudit('PARCOURS_STEP_COMPLETE'), completeStep);

module.exports = router;
