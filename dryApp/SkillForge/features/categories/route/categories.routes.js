const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateSkillForge, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const CategoriesSchema = require('../model/categories.schema');
// Mode Professionnel: securite globale geree par le DRY (security.middleware.js)\n

const create = require('../controller/categories.create.controller');
const getAll = require('../controller/categories.getAll.controller');
const getById = require('../controller/categories.getById.controller');
const update = require('../controller/categories.update.controller');
const remove = require('../controller/categories.delete.controller');

// Mode Professionnel: securite globale activee dans le serveur\n

// Injection du modele dynamique pour ce tenant (multi-tenant)
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Categories', CategoriesSchema);
  next();
};

// Query builder generique reutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// =========================
// Routes publiques (lecture)
// =========================
/**
 * @swagger
 * /api/v1/skillforge/categories:
 *   get:
 *     summary: Lister Categories
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
 *         description: Liste Categories
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
 * /api/v1/skillforge/categories/{id}:
 *   get:
 *     summary: Recuperer Categories par ID
 *     tags: [SkillForge]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categories recupere
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
 * /api/v1/skillforge/categories:
 *   post:
 *     summary: Creer Categories
 *     tags: [SkillForge]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *         name:
 *           type: string
 *           example: "exemple_name"
 *         description:
 *           type: string
 *           example: "exemple_description"
 *         slug:
 *           type: string
 *           example: "exemple_slug"
 *         icon:
 *           type: string
 *           example: "exemple_icon"
 *         parentId:
 *           type: string
 *           example: "exemple_parentId"
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
 *         description: Categories cree
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
  ensureLabel('categories'),
  validateSkillForge.categories.create,
  withAudit('CATEGORIES_CREATE'),
  invalidateCache(),
  create
);

/**
 * @swagger
 * /api/v1/skillforge/categories/{id}:
 *   put:
 *     summary: Mettre a jour Categories
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
 *         name:
 *           type: string
 *           example: "exemple_name"
 *         description:
 *           type: string
 *           example: "exemple_description"
 *         slug:
 *           type: string
 *           example: "exemple_slug"
 *         icon:
 *           type: string
 *           example: "exemple_icon"
 *         parentId:
 *           type: string
 *           example: "exemple_parentId"
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
 *         description: Categories mis a jour
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
  ensureLabel('categories'),
  validateSkillForge.categories.update,
  withAudit('CATEGORIES_UPDATE'),
  invalidateCache(),
  update
);

/**
 * @swagger
 * /api/v1/skillforge/categories/{id}:
 *   delete:
 *     summary: Supprimer Categories
 *     tags: [SkillForge]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categories supprime
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
  withAudit('CATEGORIES_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
