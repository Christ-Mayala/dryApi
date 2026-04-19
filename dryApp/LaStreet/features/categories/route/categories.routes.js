const express = require('express');
/**
 * @swagger
 * /api/v1/lastreet/categories:
 *   get:
 *     summary: Lister Categories
 *     tags: [LaStreet]
 *     responses:
 *       200:
 *         description: Liste Categories
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
 *     summary: Creer Categories
 *     tags: [LaStreet]
 *     responses:
 *       200:
 *         description: Categories cree
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
 * /api/v1/lastreet/categories/{id}:
 *   get:
 *     summary: Recuperer Categories par ID
 *     tags: [LaStreet]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categories recupere
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
 *     summary: Mettre a jour Categories
 *     tags: [LaStreet]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categories mis a jour
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
 *     summary: Supprimer Categories
 *     tags: [LaStreet]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categories supprime
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

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');

const listCategories = require('../controller/categories.list.controller');
const createCategory = require('../controller/categories.create.controller');
const updateCategory = require('../controller/categories.update.controller');
const deleteCategory = require('../controller/categories.delete.controller');

const createTrade = require('../controller/trades.create.controller');
const updateTrade = require('../controller/trades.update.controller');
const deleteTrade = require('../controller/trades.delete.controller');

router.get('/', cache(3600), listCategories);
router.post('/', protect, authorize('admin'), invalidateCache(), createCategory); 
router.put('/:id', protect, authorize('admin'), invalidateCache(), updateCategory); 
router.delete('/:id', protect, authorize('admin'), invalidateCache(), deleteCategory); 
router.post('/trades', protect, authorize('admin'), invalidateCache(), createTrade); 
router.put('/trades/:id', protect, authorize('admin'), invalidateCache(), updateTrade); 
router.delete('/trades/:id', protect, authorize('admin'), invalidateCache(), deleteTrade);
 
module.exports = router;
