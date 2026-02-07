const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateEduPro, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const InscriptionSchema = require('../model/inscriptions.schema');
// Mode Professionnel: securite globale geree par le DRY (security.middleware.js)\n

const create = require('../controller/inscriptions.create.controller');
const getAll = require('../controller/inscriptions.getAll.controller');
const getById = require('../controller/inscriptions.getById.controller');
const update = require('../controller/inscriptions.update.controller');
const remove = require('../controller/inscriptions.delete.controller');

// Mode Professionnel: securite globale activee dans le serveur\n

// Injection du modele dynamique pour ce tenant (multi-tenant)
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Inscription', InscriptionSchema);
  next();
};

// Query builder generique reutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// =========================
// Routes publiques (lecture)
// =========================
/**
 * @swagger
 * /api/v1/edupro/inscriptions:
 *   get:
 *     summary: Lister Inscription
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
 *         description: Liste Inscription
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
 * /api/v1/edupro/inscriptions/{id}:
 *   get:
 *     summary: Recuperer Inscription par ID
 *     tags: [EduPro]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Inscription recupere
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
 * /api/v1/edupro/inscriptions:
 *   post:
 *     summary: Creer Inscription
 *     tags: [EduPro]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *         etudiantId:
 *           type: string
 *           example: "exemple_etudiantId"
 *         coursId:
 *           type: string
 *           example: "exemple_coursId"
 *         dateInscription:
 *           type: string
 *           example: "2026-01-01T12:00:00.000Z"
 *         statut:
 *           type: string
 *           example: "exemple_statut"
 *         label:
 *           type: string
 *           example: "exemple_label"
 *     responses:
 *       200:
 *         description: Inscription cree
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
  ensureLabel('inscriptions'),
  validateEduPro.inscriptions.create,
  withAudit('INSCRIPTIONS_CREATE'),
  invalidateCache(),
  create
);

/**
 * @swagger
 * /api/v1/edupro/inscriptions/{id}:
 *   put:
 *     summary: Mettre a jour Inscription
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
 *         etudiantId:
 *           type: string
 *           example: "exemple_etudiantId"
 *         coursId:
 *           type: string
 *           example: "exemple_coursId"
 *         dateInscription:
 *           type: string
 *           example: "2026-01-01T12:00:00.000Z"
 *         statut:
 *           type: string
 *           example: "exemple_statut"
 *         label:
 *           type: string
 *           example: "exemple_label"
 *     responses:
 *       200:
 *         description: Inscription mis a jour
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
  ensureLabel('inscriptions'),
  validateEduPro.inscriptions.update,
  withAudit('INSCRIPTIONS_UPDATE'),
  invalidateCache(),
  update
);

/**
 * @swagger
 * /api/v1/edupro/inscriptions/{id}:
 *   delete:
 *     summary: Supprimer Inscription
 *     tags: [EduPro]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Inscription supprime
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
  withAudit('INSCRIPTIONS_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
