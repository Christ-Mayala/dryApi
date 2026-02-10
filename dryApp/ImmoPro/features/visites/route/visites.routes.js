const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateImmoPro, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const VisiteSchema = require('../model/visites.schema');
// Mode Professionnel: securite globale geree par le DRY (security.middleware.js)\n

const create = require('../controller/visites.create.controller');
const getAll = require('../controller/visites.getAll.controller');
const getById = require('../controller/visites.getById.controller');
const update = require('../controller/visites.update.controller');
const remove = require('../controller/visites.delete.controller');

// Mode Professionnel: securite globale activee dans le serveur\n

// Injection du modele dynamique pour ce tenant (multi-tenant)
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Visite', VisiteSchema);
  next();
};

// Query builder generique reutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// =========================
// Routes publiques (lecture)
// =========================
/**
 * @swagger
 * /api/v1/immopro/visites:
 *   get:
 *     summary: Lister Visite
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
 *         description: Liste Visite
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
 * /api/v1/immopro/visites/{id}:
 *   get:
 *     summary: Recuperer Visite par ID
 *     tags: [ImmoPro]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Visite recupere
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
 * /api/v1/immopro/visites:
 *   post:
 *     summary: Creer Visite
 *     tags: [ImmoPro]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *         bienId:
 *           type: string
 *           example: "exemple_bienId"
 *         clientId:
 *           type: string
 *           example: "exemple_clientId"
 *         dateVisite:
 *           type: string
 *           example: "2026-01-01T12:00:00.000Z"
 *         statut:
 *           type: string
 *           example: "exemple_statut"
 *         commentaire:
 *           type: string
 *           example: "exemple_commentaire"
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
 *         description: Visite cree
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
  ensureLabel('visites'),
  validateImmoPro.visites.create,
  withAudit('VISITES_CREATE'),
  invalidateCache(),
  create
);

/**
 * @swagger
 * /api/v1/immopro/visites/{id}:
 *   put:
 *     summary: Mettre a jour Visite
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
 *         bienId:
 *           type: string
 *           example: "exemple_bienId"
 *         clientId:
 *           type: string
 *           example: "exemple_clientId"
 *         dateVisite:
 *           type: string
 *           example: "2026-01-01T12:00:00.000Z"
 *         statut:
 *           type: string
 *           example: "exemple_statut"
 *         commentaire:
 *           type: string
 *           example: "exemple_commentaire"
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
 *         description: Visite mis a jour
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
  ensureLabel('visites'),
  validateImmoPro.visites.update,
  withAudit('VISITES_UPDATE'),
  invalidateCache(),
  update
);

/**
 * @swagger
 * /api/v1/immopro/visites/{id}:
 *   delete:
 *     summary: Supprimer Visite
 *     tags: [ImmoPro]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Visite supprime
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
  withAudit('VISITES_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
