const express = require('express');
const router = express.Router();

const { protect, protectWithQueryToken, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateMediaDL, ensureLabel } = require('../../../validation/middleware');
const { invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const DownloadsSchema = require('../model/downloads.schema');

const create = require('../controller/downloads.create.controller');
const getAll = require('../controller/downloads.getAll.controller');
const getById = require('../controller/downloads.getById.controller');
const update = require('../controller/downloads.update.controller');
const remove = require('../controller/downloads.delete.controller');
const cancel = require('../controller/downloads.cancel.controller');
const file = require('../controller/downloads.file.controller');
const platforms = require('../controller/downloads.platforms.controller');
const start = require('../controller/downloads.start.controller');
const youtubeMetadata = require('./youtube-metadata.route');

const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Downloads', DownloadsSchema);
  next();
};

const scopeToUser = (req, res, next) => {
  if (req.user && req.user.role !== 'admin') {
    req.query.requestedBy = String(req.user.id);
  }
  next();
};

const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

/**
 * @swagger
 * /api/v1/mediadl/downloads:
 *   get:
 *     summary: Lister Downloads
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
 *         description: Liste Downloads
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
router.get('/', protect, scopeToUser, setupModel, validateQuery.pagination, dynamicQB, getAll);

router.get('/platforms', protect, platforms);

/**
 * @swagger
 * /api/v1/mediadl/downloads/{id}:
 *   get:
 *     summary: Recuperer Downloads par ID
 *     tags: [MediaDL]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Downloads recupere
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
router.get('/:id', protect, validateId, getById);

router.get('/:id/file', protectWithQueryToken, validateId, file);

router.post(
  '/start',
  protect,
  ensureLabel('downloads'),
  validateMediaDL.downloads.create,
  withAudit('DOWNLOADS_START'),
  invalidateCache(),
  start
);

router.post(
  '/:id/cancel',
  protect,
  validateId,
  withAudit('DOWNLOADS_CANCEL'),
  invalidateCache(),
  cancel
);

/**
 * @swagger
 * /api/v1/mediadl/downloads:
 *   post:
 *     summary: Creer Downloads
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
 *         url:
 *           type: string
 *           example: "exemple_url"
 *         platform:
 *           type: string
 *           example: "exemple_platform"
 *         mediaType:
 *           type: string
 *           example: "exemple_mediaType"
 *         filename:
 *           type: string
 *           example: "exemple_filename"
 *         status:
 *           type: string
 *           example: "exemple_status"
 *         sizeBytes:
 *           type: number
 *           example: 100
 *         error:
 *           type: string
 *           example: "exemple_error"
 *         requestedBy:
 *           type: string
 *           example: "exemple_requestedBy"
 *         startedAt:
 *           type: string
 *           example: "2026-01-01T12:00:00.000Z"
 *         finishedAt:
 *           type: string
 *           example: "2026-01-01T12:00:00.000Z"
 *     responses:
 *       200:
 *         description: Downloads cree
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
  ensureLabel('downloads'),
  validateMediaDL.downloads.create,
  withAudit('DOWNLOADS_CREATE'),
  invalidateCache(),
  create
);

/**
 * @swagger
 * /api/v1/mediadl/downloads/{id}:
 *   put:
 *     summary: Mettre a jour Downloads
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
 *         url:
 *           type: string
 *           example: "exemple_url"
 *         platform:
 *           type: string
 *           example: "exemple_platform"
 *         mediaType:
 *           type: string
 *           example: "exemple_mediaType"
 *         filename:
 *           type: string
 *           example: "exemple_filename"
 *         status:
 *           type: string
 *           example: "exemple_status"
 *         sizeBytes:
 *           type: number
 *           example: 100
 *         error:
 *           type: string
 *           example: "exemple_error"
 *         requestedBy:
 *           type: string
 *           example: "exemple_requestedBy"
 *         startedAt:
 *           type: string
 *           example: "2026-01-01T12:00:00.000Z"
 *         finishedAt:
 *           type: string
 *           example: "2026-01-01T12:00:00.000Z"
 *     responses:
 *       200:
 *         description: Downloads mis a jour
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
  ensureLabel('downloads'),
  validateMediaDL.downloads.update,
  withAudit('DOWNLOADS_UPDATE'),
  invalidateCache(),
  update
);

/**
 * @swagger
 * /api/v1/mediadl/downloads/{id}:
 *   delete:
 *     summary: Supprimer Downloads
 *     tags: [MediaDL]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Downloads supprime
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
  validateId,
  withAudit('DOWNLOADS_DELETE'),
  invalidateCache(),
  remove
);

// Utiliser les routes de YouTube metadata
router.use('/youtube/metadata', youtubeMetadata);

module.exports = router;
