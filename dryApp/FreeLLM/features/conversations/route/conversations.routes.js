const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateFreeLLM, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const ConversationsSchema = require('../model/conversations.schema');

const create = require('../controller/conversations.create.controller');
const getAll = require('../controller/conversations.getAll.controller');
const getById = require('../controller/conversations.getById.controller');
const update = require('../controller/conversations.update.controller');
const remove = require('../controller/conversations.delete.controller');

const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Conversations', ConversationsSchema);
  next();
};

const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

router.get('/', setupModel, validateQuery.pagination, cache(300), dynamicQB, getAll);

router.get('/:id', validateId, cache(600), getById);

router.post(
  '/',
  protect,
  authorize('admin'),
  ensureLabel('conversations'),
  withAudit('CONVERSATIONS_CREATE'),
  invalidateCache(),
  create
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateId,
  ensureLabel('conversations'),
  withAudit('CONVERSATIONS_UPDATE'),
  invalidateCache(),
  update
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validateId,
  withAudit('CONVERSATIONS_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
