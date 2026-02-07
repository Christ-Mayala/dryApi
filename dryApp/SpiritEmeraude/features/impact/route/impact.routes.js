const express = require('express');
/**
 * @swagger
 * /api/v1/spiritemeraude/impact:
 *   get:
 *     summary: Lister Impact
 *     tags: [SpiritEmeraude]
 *     responses:
 *       200:
 *         description: Liste Impact
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
 *     summary: Creer Impact
 *     tags: [SpiritEmeraude]
 *     responses:
 *       200:
 *         description: Impact cree
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
 * /api/v1/spiritemeraude/impact/{id}:
 *   get:
 *     summary: Recuperer Impact par ID
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Impact recupere
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
 *     summary: Mettre a jour Impact
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Impact mis a jour
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
 *     summary: Supprimer Impact
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Impact supprime
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

// CORRECTION DES IMPORTS (Ajout de .controller)
const create = require('../controller/impact.create.controller');
const list = require('../controller/impact.list.controller');
const update = require('../controller/impact.update.controller'); // Si tu l'as créé
const remove = require('../controller/impact.delete.controller');






router.get('/', list);







router.post('/', protect, authorize('admin'), upload.fields([


    { name: 'images', maxCount: 50 },
    { name: 'videos', maxCount: 50 }
]), create);





router.put('/:id', protect, authorize('admin'), upload.fields([


    { name: 'images', maxCount: 50 },
    { name: 'videos', maxCount: 50 }
]), update);





router.delete('/:id', protect, authorize('admin'), remove);



module.exports = router;