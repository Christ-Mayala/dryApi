const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateSkillForge, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const StudentsSchema = require('../model/students.schema');
// Mode Professionnel: securite globale geree par le DRY (security.middleware.js)\n

const create = require('../controller/students.create.controller');
const getAll = require('../controller/students.getAll.controller');
const getById = require('../controller/students.getById.controller');
const update = require('../controller/students.update.controller');
const remove = require('../controller/students.delete.controller');

// Mode Professionnel: securite globale activee dans le serveur\n

// Injection du modele dynamique pour ce tenant (multi-tenant)
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Students', StudentsSchema);
  next();
};

// Query builder generique reutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// =========================
// Routes publiques (lecture)
// =========================
/**
 * @swagger
 * /api/v1/skillforge/students:
 *   get:
 *     summary: Lister Students
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
 *         description: Liste Students
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
 * /api/v1/skillforge/students/{id}:
 *   get:
 *     summary: Recuperer Students par ID
 *     tags: [SkillForge]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Students recupere
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
 * /api/v1/skillforge/students:
 *   post:
 *     summary: Creer Students
 *     tags: [SkillForge]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *         fullName:
 *           type: string
 *           example: "exemple_fullName"
 *         email:
 *           type: string
 *           example: "demo@example.com"
 *         phone:
 *           type: string
 *           example: "exemple_phone"
 *         preferences:
 *           type: array
 *           example: []
 *         balance:
 *           type: number
 *           example: 100
 *         enrolledCourses:
 *           type: array
 *           example: []
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
 *         description: Students cree
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
  ensureLabel('students'),
  validateSkillForge.students.create,
  withAudit('STUDENTS_CREATE'),
  invalidateCache(),
  create
);

/**
 * @swagger
 * /api/v1/skillforge/students/{id}:
 *   put:
 *     summary: Mettre a jour Students
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
 *         fullName:
 *           type: string
 *           example: "exemple_fullName"
 *         email:
 *           type: string
 *           example: "demo@example.com"
 *         phone:
 *           type: string
 *           example: "exemple_phone"
 *         preferences:
 *           type: array
 *           example: []
 *         balance:
 *           type: number
 *           example: 100
 *         enrolledCourses:
 *           type: array
 *           example: []
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
 *         description: Students mis a jour
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
  ensureLabel('students'),
  validateSkillForge.students.update,
  withAudit('STUDENTS_UPDATE'),
  invalidateCache(),
  update
);

/**
 * @swagger
 * /api/v1/skillforge/students/{id}:
 *   delete:
 *     summary: Supprimer Students
 *     tags: [SkillForge]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Students supprime
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
  withAudit('STUDENTS_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
