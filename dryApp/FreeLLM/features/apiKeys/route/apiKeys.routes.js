const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateFreeLLM, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const ApiKeysSchema = require('../model/apiKeys.schema');

const create = require('../controller/apiKeys.create.controller');
const getAll = require('../controller/apiKeys.getAll.controller');
const getById = require('../controller/apiKeys.getById.controller');
const update = require('../controller/apiKeys.update.controller');
const remove = require('../controller/apiKeys.delete.controller');

const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('ApiKeys', ApiKeysSchema);
  next();
};

const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

router.get('/', setupModel, validateQuery.pagination, cache(300), dynamicQB, getAll);

router.get('/:id', validateId, cache(600), getById);

router.post(
  '/',
  protect,
  authorize('admin'),
  ensureLabel('apiKeys'),
  withAudit('APIKEYS_CREATE'),
  invalidateCache(),
  create
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateId,
  ensureLabel('apiKeys'),
  withAudit('APIKEYS_UPDATE'),
  invalidateCache(),
  update
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validateId,
  withAudit('APIKEYS_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
