const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateImmoPro, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const BienSchema = require('../model/biens.schema');
// Mode Professionnel: securite globale geree par le DRY (security.middleware.js)\n

const create = require('../controller/biens.create.controller');
const getAll = require('../controller/biens.getAll.controller');
const getById = require('../controller/biens.getById.controller');
const update = require('../controller/biens.update.controller');
const remove = require('../controller/biens.delete.controller');

// Mode Professionnel: securite globale activee dans le serveur\n

// Injection du modele dynamique pour ce tenant (multi-tenant)
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Bien', BienSchema);
  next();
};

// Query builder generique reutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// =========================
// Routes publiques (lecture)
// =========================
/**
 * @swagger
 * /api/v1/immopro/biens:
 *   get:
 *     summary: Lister Bien
 *     tags: [ImmoPro]
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
 *         description: Liste Bien
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
 * /api/v1/immopro/biens/{id}:
 *   get:
 *     summary: Recuperer Bien par ID
 *     tags: [ImmoPro]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bien recupere
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
 * /api/v1/immopro/biens:
 *   post:
 *     summary: Creer Bien
 *     tags: [ImmoPro]
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
 *         prix:
 *           type: number
 *           example: 100
 *         type:
 *           type: string
 *           example: "exemple_type"
 *         surface:
 *           type: number
 *           example: 100
 *         chambres:
 *           type: number
 *           example: 100
 *         sallesDeBain:
 *           type: number
 *           example: 100
 *         adresse:
 *           type: string
 *           example: "exemple_adresse"
 *         ville:
 *           type: string
 *           example: "exemple_ville"
 *         codePostal:
 *           type: string
 *           example: "exemple_codePostal"
 *         disponible:
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
 *         description: Bien cree
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
  ensureLabel('biens'),
  validateImmoPro.biens.create,
  withAudit('BIENS_CREATE'),
  invalidateCache(),
  create
);

/**
 * @swagger
 * /api/v1/immopro/biens/{id}:
 *   put:
 *     summary: Mettre a jour Bien
 *     tags: [ImmoPro]
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
 *         prix:
 *           type: number
 *           example: 100
 *         type:
 *           type: string
 *           example: "exemple_type"
 *         surface:
 *           type: number
 *           example: 100
 *         chambres:
 *           type: number
 *           example: 100
 *         sallesDeBain:
 *           type: number
 *           example: 100
 *         adresse:
 *           type: string
 *           example: "exemple_adresse"
 *         ville:
 *           type: string
 *           example: "exemple_ville"
 *         codePostal:
 *           type: string
 *           example: "exemple_codePostal"
 *         disponible:
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
 *         description: Bien mis a jour
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
  ensureLabel('biens'),
  validateImmoPro.biens.update,
  withAudit('BIENS_UPDATE'),
  invalidateCache(),
  update
);

/**
 * @swagger
 * /api/v1/immopro/biens/{id}:
 *   delete:
 *     summary: Supprimer Bien
 *     tags: [ImmoPro]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bien supprime
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
  withAudit('BIENS_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
