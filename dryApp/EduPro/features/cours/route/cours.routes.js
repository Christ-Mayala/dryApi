const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateEduPro, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const CoursSchema = require('../model/cours.schema');
// Mode Professionnel: securite globale geree par le DRY (security.middleware.js)\n

const create = require('../controller/cours.create.controller');
const getAll = require('../controller/cours.getAll.controller');
const getById = require('../controller/cours.getById.controller');
const update = require('../controller/cours.update.controller');
const remove = require('../controller/cours.delete.controller');

// Mode Professionnel: securite globale activee dans le serveur\n

// Injection du modele dynamique pour ce tenant (multi-tenant)
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Cours', CoursSchema);
  next();
};

// Query builder generique reutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// =========================
// Routes publiques (lecture)
// =========================
/**
 * @swagger
 * /api/v1/edupro/cours:
 *   get:
 *     summary: Lister Cours
 *     tags: [EduPro]
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
 *         description: Liste Cours
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
 * /api/v1/edupro/cours/{id}:
 *   get:
 *     summary: Recuperer Cours par ID
 *     tags: [EduPro]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cours recupere
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
 * /api/v1/edupro/cours:
 *   post:
 *     summary: Creer Cours
 *     tags: [EduPro]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *         titre:
 *           type: string
 *           example: "exemple_titre"
 *         description:
 *           type: string
 *           example: "exemple_description"
 *         niveau:
 *           type: string
 *           example: "exemple_niveau"
 *         duree:
 *           type: number
 *           example: 100
 *         prix:
 *           type: number
 *           example: 100
 *         label:
 *           type: string
 *           example: "exemple_label"
 *     responses:
 *       200:
 *         description: Cours cree
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
  ensureLabel('cours'),
  validateEduPro.cours.create,
  withAudit('COURS_CREATE'),
  invalidateCache(),
  create
);

/**
 * @swagger
 * /api/v1/edupro/cours/{id}:
 *   put:
 *     summary: Mettre a jour Cours
 *     tags: [EduPro]
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
 *         titre:
 *           type: string
 *           example: "exemple_titre"
 *         description:
 *           type: string
 *           example: "exemple_description"
 *         niveau:
 *           type: string
 *           example: "exemple_niveau"
 *         duree:
 *           type: number
 *           example: 100
 *         prix:
 *           type: number
 *           example: 100
 *         label:
 *           type: string
 *           example: "exemple_label"
 *     responses:
 *       200:
 *         description: Cours mis a jour
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
  ensureLabel('cours'),
  validateEduPro.cours.update,
  withAudit('COURS_UPDATE'),
  invalidateCache(),
  update
);

/**
 * @swagger
 * /api/v1/edupro/cours/{id}:
 *   delete:
 *     summary: Supprimer Cours
 *     tags: [EduPro]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cours supprime
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
  withAudit('COURS_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
