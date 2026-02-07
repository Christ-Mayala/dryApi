const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateMediaDL, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const BatchesSchema = require('../model/batches.schema');
// Mode Professionnel: securite globale geree par le DRY (security.middleware.js)\n

const create = require('../controller/batches.create.controller');
const getAll = require('../controller/batches.getAll.controller');
const getById = require('../controller/batches.getById.controller');
const update = require('../controller/batches.update.controller');
const remove = require('../controller/batches.delete.controller');

// Mode Professionnel: securite globale activee dans le serveur\n

// Injection du modele dynamique pour ce tenant (multi-tenant)
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Batches', BatchesSchema);
  next();
};

// Query builder generique reutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// =========================
// Routes publiques (lecture)
// =========================
/**
 * @swagger
 * /api/v1/mediadl/batches:
 *   get:
 *     summary: Lister Batches
 *     tags: [MediaDL]
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
 *         description: Liste Batches
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
 * /api/v1/mediadl/batches/{id}:
 *   get:
 *     summary: Recuperer Batches par ID
 *     tags: [MediaDL]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Batches recupere
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
 * /api/v1/mediadl/batches:
 *   post:
 *     summary: Creer Batches
 *     tags: [MediaDL]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *         label:
 *           type: string
 *           example: "exemple_label"
 *         sourceType:
 *           type: string
 *           example: "exemple_sourceType"
 *         total:
 *           type: number
 *           example: 100
 *         completed:
 *           type: number
 *           example: 100
 *         failed:
 *           type: number
 *           example: 100
 *         status:
 *           type: string
 *           example: "exemple_status"
 *         createdBy:
 *           type: string
 *           example: "exemple_createdBy"
 *         startedAt:
 *           type: string
 *           example: "2026-01-01T12:00:00.000Z"
 *         finishedAt:
 *           type: string
 *           example: "2026-01-01T12:00:00.000Z"
 *     responses:
 *       200:
 *         description: Batches cree
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
  ensureLabel('batches'),
  validateMediaDL.batches.create,
  withAudit('BATCHES_CREATE'),
  invalidateCache(),
  create
);

/**
 * @swagger
 * /api/v1/mediadl/batches/{id}:
 *   put:
 *     summary: Mettre a jour Batches
 *     tags: [MediaDL]
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
 *         label:
 *           type: string
 *           example: "exemple_label"
 *         sourceType:
 *           type: string
 *           example: "exemple_sourceType"
 *         total:
 *           type: number
 *           example: 100
 *         completed:
 *           type: number
 *           example: 100
 *         failed:
 *           type: number
 *           example: 100
 *         status:
 *           type: string
 *           example: "exemple_status"
 *         createdBy:
 *           type: string
 *           example: "exemple_createdBy"
 *         startedAt:
 *           type: string
 *           example: "2026-01-01T12:00:00.000Z"
 *         finishedAt:
 *           type: string
 *           example: "2026-01-01T12:00:00.000Z"
 *     responses:
 *       200:
 *         description: Batches mis a jour
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
  ensureLabel('batches'),
  validateMediaDL.batches.update,
  withAudit('BATCHES_UPDATE'),
  invalidateCache(),
  update
);

/**
 * @swagger
 * /api/v1/mediadl/batches/{id}:
 *   delete:
 *     summary: Supprimer Batches
 *     tags: [MediaDL]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Batches supprime
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
  withAudit('BATCHES_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
