const express = require('express');
/**
 * @swagger
 * /api/v1/spiritemeraude/contact:
 *   get:
 *     summary: Lister Contact
 *     tags: [SpiritEmeraude]
 *     responses:
 *       200:
 *         description: Liste Contact
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
 *     summary: Creer Contact
 *     tags: [SpiritEmeraude]
 *     responses:
 *       200:
 *         description: Contact cree
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
 * /api/v1/spiritemeraude/contact/{id}:
 *   get:
 *     summary: Recuperer Contact par ID
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact recupere
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
 *     summary: Mettre a jour Contact
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact mis a jour
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
 *     summary: Supprimer Contact
 *     tags: [SpiritEmeraude]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact supprime
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

const sendMessage = require('../controller/contact.send.controller');
const listMessages = require('../controller/contact.list.controller');
const deleteMessage = require('../controller/contact.delete.controller');






router.post('/', sendMessage);







router.get('/', protect, authorize('admin'), listMessages);







router.delete('/:id', protect, authorize('admin'), deleteMessage);



module.exports = router;