const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateSkillForge, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const EbooksSchema = require('../model/ebooks.schema');
// Mode Professionnel: securite globale geree par le DRY (security.middleware.js)\n

const create = require('../controller/ebooks.create.controller');
const getAll = require('../controller/ebooks.getAll.controller');
const getById = require('../controller/ebooks.getById.controller');
const update = require('../controller/ebooks.update.controller');
const remove = require('../controller/ebooks.delete.controller');

// Mode Professionnel: securite globale activee dans le serveur\n

// Injection du modele dynamique pour ce tenant (multi-tenant)
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Ebooks', EbooksSchema);
  next();
};

// Query builder generique reutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// =========================
// Routes publiques (lecture)
// =========================
/**
 * @swagger
 * /api/v1/skillforge/ebooks:
 *   get:
 *     summary: Lister Ebooks
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
 *         description: Liste Ebooks
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
 * /api/v1/skillforge/ebooks/{id}:
 *   get:
 *     summary: Recuperer Ebooks par ID
 *     tags: [SkillForge]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ebooks recupere
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
 * /api/v1/skillforge/ebooks:
 *   post:
 *     summary: Creer Ebooks
 *     tags: [SkillForge]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *         title:
 *           type: string
 *           example: "exemple_title"
 *         author:
 *           type: string
 *           example: "exemple_author"
 *         price:
 *           type: number
 *           example: 100
 *         summary:
 *           type: string
 *           example: "exemple_summary"
 *         pages:
 *           type: number
 *           example: 100
 *         format:
 *           type: string
 *           example: "exemple_format"
 *         coverUrl:
 *           type: string
 *           example: "exemple_coverUrl"
 *         fileUrl:
 *           type: string
 *           example: "exemple_fileUrl"
 *         label:
 *           type: string
 *           example: "exemple_label"
 *         status:
 *           type: string
 *           enum: [active, inactive, deleted, banned]
 *           example: active
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Ebooks cree
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
  ensureLabel('ebooks'),
  validateSkillForge.ebooks.create,
  withAudit('EBOOKS_CREATE'),
  invalidateCache(),
  create
);

/**
 * @swagger
 * /api/v1/skillforge/ebooks/{id}:
 *   put:
 *     summary: Mettre a jour Ebooks
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
 *         title:
 *           type: string
 *           example: "exemple_title"
 *         author:
 *           type: string
 *           example: "exemple_author"
 *         price:
 *           type: number
 *           example: 100
 *         summary:
 *           type: string
 *           example: "exemple_summary"
 *         pages:
 *           type: number
 *           example: 100
 *         format:
 *           type: string
 *           example: "exemple_format"
 *         coverUrl:
 *           type: string
 *           example: "exemple_coverUrl"
 *         fileUrl:
 *           type: string
 *           example: "exemple_fileUrl"
 *         label:
 *           type: string
 *           example: "exemple_label"
 *         status:
 *           type: string
 *           enum: [active, inactive, deleted, banned]
 *           example: active
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Ebooks mis a jour
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
  ensureLabel('ebooks'),
  validateSkillForge.ebooks.update,
  withAudit('EBOOKS_UPDATE'),
  invalidateCache(),
  update
);

/**
 * @swagger
 * /api/v1/skillforge/ebooks/{id}:
 *   delete:
 *     summary: Supprimer Ebooks
 *     tags: [SkillForge]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ebooks supprime
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
  withAudit('EBOOKS_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
