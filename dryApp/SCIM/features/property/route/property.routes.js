const express = require('express');
/**
 * @swagger
 * /api/v1/scim/property:
 *   get:
 *     summary: Lister Property
 *     tags: [SCIM]
 *     responses:
 *       200:
 *         description: Liste Property
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
 *     summary: Creer Property
 *     tags: [SCIM]
 *     responses:
 *       200:
 *         description: Property cree
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
 * /api/v1/scim/property/{id}:
 *   get:
 *     summary: Recuperer Property par ID
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property recupere
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
 *     summary: Mettre a jour Property
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property mis a jour
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
 *     summary: Supprimer Property
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property supprime
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
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateQuery, validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateSCIM } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const createProperty = require('../controller/property.create.controller');
const listProperties = require('../controller/property.list.controller');
const getPropertyById = require('../controller/property.get.controller');
const updateProperty = require('../controller/property.update.controller');
const deleteProperty = require('../controller/property.delete.controller');
const toggleFavori = require('../controller/property.favoris.controller');
const rateProperty = require('../controller/property.rate.controller');
const getPropertyWithRating = require('../controller/property.rating.controller');
const recordVisit = require('../controller/property.visit.controller');

const propertyUpload = upload.fields([
  { name: 'images', maxCount: 10 }
]);

// Routes publiques avec cache





router.get('/', cache(300), listProperties);







router.get('/:id', validateId, cache(600), getPropertyById);



// Routes admin sécurisées (écriture avec audit, validation et rôle admin)





router.post('/', protect, authorize('admin'), withAudit('CREATE_PROPERTY'), propertyUpload, validateSCIM.property.create, invalidateCache(), createProperty);







router.put('/:id', protect, authorize('admin'), validateId, propertyUpload, validateSCIM.property.update, invalidateCache(), updateProperty);







router.delete('/:id', protect, authorize('admin'), validateId, invalidateCache(), deleteProperty);



// Routes utilisateur avec validation





router.post('/:id/favoris', protect, validateId, toggleFavori);







router.post('/:id/rate', protect, validateId, validateSCIM.reservation.create, rateProperty);







router.get('/:id/rating', protect, validateId, getPropertyWithRating);







router.post('/:id/visit', protect, validateId, recordVisit);



module.exports = router;
