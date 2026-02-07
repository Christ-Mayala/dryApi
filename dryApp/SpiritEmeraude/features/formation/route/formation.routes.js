const express = require('express');
/**
 * @swagger
 * /api/v1/spiritemeraude/formation:
 *   get:
 *     summary: Lister Formation
 *     tags: [SpiritEmeraude]
 *     responses:
 *       200:
 *         description: Liste Formation
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
 *     summary: Creer Formation
 *     tags: [SpiritEmeraude]
 *     responses:
 *       200:
 *         description: Formation cree
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
 * /api/v1/spiritemeraude/formation/{id}:
 *   get:
 *     summary: Recuperer Formation par ID
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Formation recupere
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
 *     summary: Mettre a jour Formation
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Formation mis a jour
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
 *     summary: Supprimer Formation
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Formation supprime
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
const FormationSchema = require('../model/formation.schema');

// CORRECTION DES IMPORTS (Ajout de .controller)
const create = require('../controller/formation.create.controller');
const list = require('../controller/formation.list.controller');
const get = require('../controller/formation.get.controller');
const update = require('../controller/formation.update.controller');
const remove = require('../controller/formation.delete.controller');

const setupModel = (req, res, next) => {
    req.targetModel = req.getModel('Formation', FormationSchema);
    next();
};
const dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);

// Routes





router.get('/', setupModel, dynamicQB, list);







router.get('/:id', get);








router.post('/', protect, authorize('admin'), upload.single('image'), create);







router.put('/:id', protect, authorize('admin'), upload.single('image'), update);







router.delete('/:id', protect, authorize('admin'), remove);



module.exports = router;