const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validatePelerin, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const BibleVerseSchema = require('../model/bible.schema');

const create = require('../controller/bible.create.controller');
const getAll = require('../controller/bible.getAll.controller');
const getById = require('../controller/bible.getById.controller');
const update = require('../controller/bible.update.controller');
const remove = require('../controller/bible.delete.controller');
const getChapter = require('../controller/bible.getChapter.controller');
const search = require('../controller/bible.search.controller');

// Injection du modele dynamique pour ce tenant (multi-tenant)
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('BibleVerse', BibleVerseSchema);
  next();
};

const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// =========================
// Routes publiques (lecture) — la Bible n'est jamais derriere une inscription
// =========================

/**
 * @swagger
 * /api/v1/pelerin/bible/chapter:
 *   get:
 *     summary: Lire un chapitre complet (tous les versets, dans l'ordre)
 *     tags: [Pelerin - Bible]
 *     parameters:
 *       - in: query
 *         name: version
 *         required: true
 *         schema: { type: string, enum: [LSG1910, DARBY, KJV] }
 *       - in: query
 *         name: bookCode
 *         required: true
 *         schema: { type: string, example: jean }
 *       - in: query
 *         name: chapter
 *         required: true
 *         schema: { type: integer, example: 3 }
 *     responses:
 *       200:
 *         description: Versets du chapitre
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.get('/chapter', cache(600), getChapter);

/**
 * @swagger
 * /api/v1/pelerin/bible/search:
 *   get:
 *     summary: Recherche plein texte dans les versets
 *     tags: [Pelerin - Bible]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: version
 *         schema: { type: string, enum: [LSG1910, DARBY, KJV] }
 *     responses:
 *       200:
 *         description: Resultats de recherche
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.get('/search', search);

/**
 * @swagger
 * /api/v1/pelerin/bible:
 *   get:
 *     summary: Lister les versets (filtrable par version, bookCode, chapter)
 *     tags: [Pelerin - Bible]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Liste de versets
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.get('/', setupModel, validateQuery.pagination, cache(300), dynamicQB, getAll);

/**
 * @swagger
 * /api/v1/pelerin/bible/{id}:
 *   get:
 *     summary: Recuperer un verset par ID
 *     tags: [Pelerin - Bible]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Verset recupere
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.get('/:id', validateId, cache(600), getById);

// ==============================================
// Routes admin securisees (correction/enrichissement du texte biblique)
// Le seed en masse des 3 versions passe par seed.js, pas par cette API.
// ==============================================

router.post(
  '/',
  protect,
  authorize('admin'),
  ensureLabel('bibleverse'),
  validatePelerin.bibleVerse.create,
  withAudit('BIBLEVERSE_CREATE'),
  invalidateCache(),
  create
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateId,
  ensureLabel('bibleverse'),
  validatePelerin.bibleVerse.update,
  withAudit('BIBLEVERSE_UPDATE'),
  invalidateCache(),
  update
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validateId,
  withAudit('BIBLEVERSE_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
