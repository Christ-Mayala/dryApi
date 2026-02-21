const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateSkillForge, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const OrdersSchema = require('../model/orders.schema');
// Mode Professionnel: securite globale geree par le DRY (security.middleware.js)\n

const create = require('../controller/orders.create.controller');
const getAll = require('../controller/orders.getAll.controller');
const getById = require('../controller/orders.getById.controller');
const update = require('../controller/orders.update.controller');
const remove = require('../controller/orders.delete.controller');

// Mode Professionnel: securite globale activee dans le serveur\n

// Injection du modele dynamique pour ce tenant (multi-tenant)
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Orders', OrdersSchema);
  next();
};

// Query builder generique reutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// =========================
// Routes publiques (lecture)
// =========================
/**
 * @swagger
 * /api/v1/skillforge/orders:
 *   get:
 *     summary: Lister Orders
 *     tags: [SkillForge]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Liste Orders
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Erreur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', setupModel, validateQuery.pagination, cache(300), dynamicQB, getAll);

/**
 * @swagger
 * /api/v1/skillforge/orders/{id}:
 *   get:
 *     summary: Recuperer Orders par ID
 *     tags: [SkillForge]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Orders recupere
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Erreur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', validateId, cache(600), getById);

// ==============================================
// Routes admin securisees (ecriture / modification)
// ==============================================
/**
 * @swagger
 * /api/v1/skillforge/orders:
 *   post:
 *     summary: Creer Orders
 *     tags: [SkillForge]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               studentId:
 *                 type: string
 *                 example: "exemple_studentId"
 *               items:
 *                 type: array
 *                 example: []
 *               subtotal:
 *                 type: number
 *                 example: 100
 *               tax:
 *                 type: number
 *                 example: 100
 *               total:
 *                 type: number
 *                 example: 100
 *               paymentMethod:
 *                 type: string
 *                 example: "exemple_paymentMethod"
 *               transactionId:
 *                 type: string
 *                 example: "exemple_transactionId"
 *               label:
 *                 type: string
 *                 example: "exemple_label"
 *               status:
 *                 type: string
 *                 enum: [active, inactive, deleted, banned]
 *                 example: active
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *               updatedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Orders cree
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Erreur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/',
  protect,
  authorize('admin'),
  ensureLabel('orders'),
  validateSkillForge.orders.create,
  withAudit('ORDERS_CREATE'),
  invalidateCache(),
  create
);

/**
 * @swagger
 * /api/v1/skillforge/orders/{id}:
 *   put:
 *     summary: Mettre a jour Orders
 *     tags: [SkillForge]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               studentId:
 *                 type: string
 *                 example: "exemple_studentId"
 *               items:
 *                 type: array
 *                 example: []
 *               subtotal:
 *                 type: number
 *                 example: 100
 *               tax:
 *                 type: number
 *                 example: 100
 *               total:
 *                 type: number
 *                 example: 100
 *               paymentMethod:
 *                 type: string
 *                 example: "exemple_paymentMethod"
 *               transactionId:
 *                 type: string
 *                 example: "exemple_transactionId"
 *               label:
 *                 type: string
 *                 example: "exemple_label"
 *               status:
 *                 type: string
 *                 enum: [active, inactive, deleted, banned]
 *                 example: active
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *               updatedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Orders mis a jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Erreur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateId,
  ensureLabel('orders'),
  validateSkillForge.orders.update,
  withAudit('ORDERS_UPDATE'),
  invalidateCache(),
  update
);

/**
 * @swagger
 * /api/v1/skillforge/orders/{id}:
 *   delete:
 *     summary: Supprimer Orders
 *     tags: [SkillForge]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Orders supprime
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Erreur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validateId,
  withAudit('ORDERS_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
