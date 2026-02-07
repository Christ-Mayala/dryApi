const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateMediaDL, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const PresetsSchema = require('../model/presets.schema');
// Mode Professionnel: securite globale geree par le DRY (security.middleware.js)\n

const create = require('../controller/presets.create.controller');
const getAll = require('../controller/presets.getAll.controller');
const getById = require('../controller/presets.getById.controller');
const update = require('../controller/presets.update.controller');
const remove = require('../controller/presets.delete.controller');

// Mode Professionnel: securite globale activee dans le serveur\n

// Injection du modele dynamique pour ce tenant (multi-tenant)
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Presets', PresetsSchema);
  next();
};

// Query builder generique reutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// =========================
// Routes publiques (lecture)
// =========================
/**
 * @swagger
 * /api/v1/mediadl/presets:
 *   get:
 *     summary: Lister Presets
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
 *         description: Liste Presets
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
 * /api/v1/mediadl/presets/{id}:
 *   get:
 *     summary: Recuperer Presets par ID
 *     tags: [MediaDL]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Presets recupere
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
 * /api/v1/mediadl/presets:
 *   post:
 *     summary: Creer Presets
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
 *         qualityMode:
 *           type: string
 *           example: "exemple_qualityMode"
 *         preferAudioOnly:
 *           type: boolean
 *           example: true
 *         maxHeight:
 *           type: number
 *           example: 100
 *         downloadDir:
 *           type: string
 *           example: "exemple_downloadDir"
 *         concurrent:
 *           type: number
 *           example: 100
 *     responses:
 *       200:
 *         description: Presets cree
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
  ensureLabel('presets'),
  validateMediaDL.presets.create,
  withAudit('PRESETS_CREATE'),
  invalidateCache(),
  create
);

/**
 * @swagger
 * /api/v1/mediadl/presets/{id}:
 *   put:
 *     summary: Mettre a jour Presets
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
 *         qualityMode:
 *           type: string
 *           example: "exemple_qualityMode"
 *         preferAudioOnly:
 *           type: boolean
 *           example: true
 *         maxHeight:
 *           type: number
 *           example: 100
 *         downloadDir:
 *           type: string
 *           example: "exemple_downloadDir"
 *         concurrent:
 *           type: number
 *           example: 100
 *     responses:
 *       200:
 *         description: Presets mis a jour
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
  ensureLabel('presets'),
  validateMediaDL.presets.update,
  withAudit('PRESETS_UPDATE'),
  invalidateCache(),
  update
);

/**
 * @swagger
 * /api/v1/mediadl/presets/{id}:
 *   delete:
 *     summary: Supprimer Presets
 *     tags: [MediaDL]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Presets supprime
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
  withAudit('PRESETS_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
