const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateSkillForge, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const CoursesSchema = require('../model/courses.schema');
// Mode Professionnel: securite globale geree par le DRY (security.middleware.js)\n

const create = require('../controller/courses.create.controller');
const getAll = require('../controller/courses.getAll.controller');
const getById = require('../controller/courses.getById.controller');
const update = require('../controller/courses.update.controller');
const remove = require('../controller/courses.delete.controller');

// Mode Professionnel: securite globale activee dans le serveur\n

// Injection du modele dynamique pour ce tenant (multi-tenant)
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Courses', CoursesSchema);
  next();
};

// Query builder generique reutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// =========================
// Routes publiques (lecture)
// =========================
/**
 * @swagger
 * /api/v1/skillforge/courses:
 *   get:
 *     summary: Lister Courses
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
 *         description: Liste Courses
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
 * /api/v1/skillforge/courses/{id}:
 *   get:
 *     summary: Recuperer Courses par ID
 *     tags: [SkillForge]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Courses recupere
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
 * /api/v1/skillforge/courses:
 *   post:
 *     summary: Creer Courses
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
 *         subtitle:
 *           type: string
 *           example: "exemple_subtitle"
 *         price:
 *           type: number
 *           example: 100
 *         duration:
 *           type: number
 *           example: 100
 *         level:
 *           type: string
 *           example: "exemple_level"
 *         categoryId:
 *           type: string
 *           example: "exemple_categoryId"
 *         trailerUrl:
 *           type: string
 *           example: "exemple_trailerUrl"
 *         contentUrl:
 *           type: string
 *           example: "exemple_contentUrl"
 *         isPublished:
 *           type: boolean
 *           example: true
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
 *         description: Courses cree
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
  ensureLabel('courses'),
  validateSkillForge.courses.create,
  withAudit('COURSES_CREATE'),
  invalidateCache(),
  create
);

/**
 * @swagger
 * /api/v1/skillforge/courses/{id}:
 *   put:
 *     summary: Mettre a jour Courses
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
 *         subtitle:
 *           type: string
 *           example: "exemple_subtitle"
 *         price:
 *           type: number
 *           example: 100
 *         duration:
 *           type: number
 *           example: 100
 *         level:
 *           type: string
 *           example: "exemple_level"
 *         categoryId:
 *           type: string
 *           example: "exemple_categoryId"
 *         trailerUrl:
 *           type: string
 *           example: "exemple_trailerUrl"
 *         contentUrl:
 *           type: string
 *           example: "exemple_contentUrl"
 *         isPublished:
 *           type: boolean
 *           example: true
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
 *         description: Courses mis a jour
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
  ensureLabel('courses'),
  validateSkillForge.courses.update,
  withAudit('COURSES_UPDATE'),
  invalidateCache(),
  update
);

/**
 * @swagger
 * /api/v1/skillforge/courses/{id}:
 *   delete:
 *     summary: Supprimer Courses
 *     tags: [SkillForge]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Courses supprime
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
  withAudit('COURSES_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
