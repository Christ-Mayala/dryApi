const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateFreeLLM, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const FallbackConfigSchema = require('../model/fallbackConfig.schema');

const create = require('../controller/fallbackConfig.create.controller');
const getAll = require('../controller/fallbackConfig.getAll.controller');
const getById = require('../controller/fallbackConfig.getById.controller');
const update = require('../controller/fallbackConfig.update.controller');
const remove = require('../controller/fallbackConfig.delete.controller');

const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('FallbackConfig', FallbackConfigSchema);
  next();
};

const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

router.get('/', setupModel, validateQuery.pagination, cache(300), dynamicQB, getAll);

router.get('/:id', validateId, cache(600), getById);

router.post(
  '/',
  protect,
  authorize('admin'),
  ensureLabel('fallbackConfig'),
  withAudit('FALLBACKCONFIG_CREATE'),
  invalidateCache(),
  create
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateId,
  ensureLabel('fallbackConfig'),
  withAudit('FALLBACKCONFIG_UPDATE'),
  invalidateCache(),
  update
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validateId,
  withAudit('FALLBACKCONFIG_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
