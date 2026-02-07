const express = require('express');
/**
 * @swagger
 * /api/v1/lastreet/professionals:
 *   get:
 *     summary: Lister Professionals
 *     tags: [LaStreet]
 *     responses:
 *       200:
 *         description: Liste Professionals
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
 *   post:
 *     summary: Creer Professionals
 *     tags: [LaStreet]
 *     responses:
 *       200:
 *         description: Professionals cree
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
 *
 * /api/v1/lastreet/professionals/{id}:
 *   get:
 *     summary: Recuperer Professionals par ID
 *     tags: [LaStreet]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Professionals recupere
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
 *   put:
 *     summary: Mettre a jour Professionals
 *     tags: [LaStreet]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Professionals mis a jour
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
 *   delete:
 *     summary: Supprimer Professionals
 *     tags: [LaStreet]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Professionals supprime
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



const router = express.Router();

const upload = require('../../../../../dry/services/cloudinary/cloudinary.service');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateQuery, validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateLaStreet } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const listProfessionals = require('../controller/professionals.list.controller');
const getProfessional = require('../controller/professionals.get.controller');
const createProfessional = require('../controller/professionals.create.controller');
const getMyProfessional = require('../controller/professionals.me.get.controller');
const updateMyProfessional = require('../controller/professionals.me.update.controller');
const recommendations = require('../controller/professionals.recommendations.controller');
const rateProfessional = require('../controller/professionals.rate.controller');

const proUpload = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'gallery', maxCount: 5 }
]);

// Routes publiques avec cache





router.get('/', cache('professionals:list'), listProfessionals);







router.get('/recommendations', cache(600), recommendations);







router.get('/:id', validateId, cache('professionals:get'), getProfessional);



// Routes utilisateur avec validation et audit





router.get('/me', protect, withAudit('GET_MY_PROFESSIONAL'), getMyProfessional);







router.patch('/me', protect, withAudit('UPDATE_MY_PROFESSIONAL'), proUpload, validateLaStreet.professional.update, invalidateCache(), updateMyProfessional);







router.post('/:id/rate', protect, validateId, withAudit('RATE_PROFESSIONAL'), rateProfessional);







router.post('/', protect, withAudit('CREATE_PROFESSIONAL'), proUpload, validateLaStreet.professional.create, invalidateCache(), createProfessional);



module.exports = router;
