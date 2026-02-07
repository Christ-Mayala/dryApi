const express = require('express');
/**
 * @swagger
 * /api/v1/spiritemeraude/atelier:
 *   get:
 *     summary: Lister Atelier
 *     tags: [SpiritEmeraude]
 *     responses:
 *       200:
 *         description: Liste Atelier
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
 *     summary: Creer Atelier
 *     tags: [SpiritEmeraude]
 *     responses:
 *       200:
 *         description: Atelier cree
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
 * /api/v1/spiritemeraude/atelier/{id}:
 *   get:
 *     summary: Recuperer Atelier par ID
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Atelier recupere
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
 *     summary: Mettre a jour Atelier
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Atelier mis a jour
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
 *     summary: Supprimer Atelier
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Atelier supprime
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
const queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');
const AtelierSchema = require('../model/atelier.schema');

const create = require('../controller/atelier.create.controller');
const list = require('../controller/atelier.list.controller');
const get = require('../controller/atelier.get.controller');
const update = require('../controller/atelier.update.controller');
const remove = require('../controller/atelier.delete.controller');

const setupModel = (req, res, next) => {
    req.targetModel = req.getModel('Atelier', AtelierSchema);
    next();
};
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);






router.get('/', setupModel, dynamicQB, list);







router.get('/:id', get);








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
