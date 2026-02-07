const express = require('express');
/**
 * @swagger
 * /api/v1/spiritemeraude/product:
 *   get:
 *     summary: Lister Product
 *     tags: [SpiritEmeraude]
 *     responses:
 *       200:
 *         description: Liste Product
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
 *     summary: Creer Product
 *     tags: [SpiritEmeraude]
 *     responses:
 *       200:
 *         description: Product cree
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
 * /api/v1/spiritemeraude/product/{id}:
 *   get:
 *     summary: Recuperer Product par ID
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product recupere
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
 *     summary: Mettre a jour Product
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product mis a jour
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
 *     summary: Supprimer Product
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product supprime
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
const { validateSpiritEmeraude } = require('../../../validation/middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const ProductSchema = require('../model/product.schema');

// Contrôleurs spécifiques produit
const create = require('../controller/product.create.controller');
const list = require('../controller/product.list.controller');
const get = require('../controller/product.get.controller');
const update = require('../controller/product.update.controller');
const remove = require('../controller/product.delete.controller');

// Injection du modèle dynamique pour ce tenant
const setupModel = (req, res, next) => {
  req.targetModel = req.getModel('Product', ProductSchema);
  next();
};

// Query builder générique réutilisable (tri, pagination, filtres)
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// Routes publiques avec cache





router.get('/', setupModel, cache(300), dynamicQB, list);







router.get('/:id', validateId, cache(600), get);



// Routes admin sécurisées (écriture avec audit, validation et rôle admin)
router.post(
  '/',
  protect,
  authorize('admin'),
  upload.array('images', 5),
  validateSpiritEmeraude.product.create,
  withAudit('PRODUCT_CREATE'),
  invalidateCache(),
  create,
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  validateId,
  upload.array('images', 5),
  validateSpiritEmeraude.product.update,
  withAudit('PRODUCT_UPDATE'),
  invalidateCache(),
  update,
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  validateId,
  withAudit('PRODUCT_DELETE'),
  invalidateCache(),
  remove,
);

module.exports = router;
