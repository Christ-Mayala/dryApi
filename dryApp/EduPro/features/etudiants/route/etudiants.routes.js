const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateEduPro, ensureLabel } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const EtudiantSchema = require('../model/etudiants.schema');
// Mode Professionnel: securite globale geree par le DRY (security.middleware.js)\n

const create = require('../controller/etudiants.create.controller');
const getAll = require('../controller/etudiants.getAll.controller');
const getById = require('../controller/etudiants.getById.controller');
const update = require('../controller/etudiants.update.controller');
const remove = require('../controller/etudiants.delete.controller');

// Mode Professionnel: securite globale activee dans le serveur\n

// Injection du modele dynamique pour ce tenant (multi-tenant)
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Etudiant', EtudiantSchema);
  next();
};

// Query builder generique reutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// =========================
// Routes publiques (lecture)
// =========================
/**
 * @swagger
 * /api/v1/edupro/etudiants:
 *   get:
 *     summary: Lister Etudiant
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
 *         description: Liste Etudiant
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
 * /api/v1/edupro/etudiants/{id}:
 *   get:
 *     summary: Recuperer Etudiant par ID
 *     tags: [EduPro]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Etudiant recupere
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
 * /api/v1/edupro/etudiants:
 *   post:
 *     summary: Creer Etudiant
 *     tags: [EduPro]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *         nom:
 *           type: string
 *           example: "exemple_nom"
 *         prenom:
 *           type: string
 *           example: "exemple_prenom"
 *         email:
 *           type: string
 *           example: "demo@example.com"
 *         telephone:
 *           type: string
 *           example: "+22501020304"
 *         niveau:
 *           type: string
 *           example: "exemple_niveau"
 *         label:
 *           type: string
 *           example: "exemple_label"
 *     responses:
 *       200:
 *         description: Etudiant cree
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
  ensureLabel('etudiants'),
  validateEduPro.etudiants.create,
  withAudit('ETUDIANTS_CREATE'),
  invalidateCache(),
  create
);

/**
 * @swagger
 * /api/v1/edupro/etudiants/{id}:
 *   put:
 *     summary: Mettre a jour Etudiant
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
 *         nom:
 *           type: string
 *           example: "exemple_nom"
 *         prenom:
 *           type: string
 *           example: "exemple_prenom"
 *         email:
 *           type: string
 *           example: "demo@example.com"
 *         telephone:
 *           type: string
 *           example: "+22501020304"
 *         niveau:
 *           type: string
 *           example: "exemple_niveau"
 *         label:
 *           type: string
 *           example: "exemple_label"
 *     responses:
 *       200:
 *         description: Etudiant mis a jour
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
  ensureLabel('etudiants'),
  validateEduPro.etudiants.update,
  withAudit('ETUDIANTS_UPDATE'),
  invalidateCache(),
  update
);

/**
 * @swagger
 * /api/v1/edupro/etudiants/{id}:
 *   delete:
 *     summary: Supprimer Etudiant
 *     tags: [EduPro]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Etudiant supprime
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
  withAudit('ETUDIANTS_DELETE'),
  invalidateCache(),
  remove
);

module.exports = router;
