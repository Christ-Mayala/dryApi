const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validatePelerin, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const ReadingPlanSchema = require('../model/readingPlan.schema');

const create = require('../controller/readingPlan.create.controller');
const getAll = require('../controller/readingPlan.getAll.controller');
const getById = require('../controller/readingPlan.getById.controller');
const getByDay = require('../controller/readingPlan.getByDay.controller');
const update = require('../controller/readingPlan.update.controller');
const remove = require('../controller/readingPlan.delete.controller');

const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('ReadingPlan', ReadingPlanSchema);
  next();
};

const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// Lecture publique des plans published
router.get('/', setupModel, validateQuery.pagination, cache(600), dynamicQB, getAll);
router.get('/day/:day', cache(600), getByDay);

// Admin : CRUD
router.post('/', protect, authorize('admin'), ensureLabel('readingplan'), validatePelerin.readingPlan.create, withAudit('READINGPLAN_CREATE'), invalidateCache(), create);
router.get('/:id', validateId, cache(600), getById);
router.put('/:id', protect, authorize('admin'), validateId, ensureLabel('readingplan'), validatePelerin.readingPlan.update, withAudit('READINGPLAN_UPDATE'), invalidateCache(), update);
router.delete('/:id', protect, authorize('admin'), validateId, withAudit('READINGPLAN_DELETE'), invalidateCache(), remove);

module.exports = router;
