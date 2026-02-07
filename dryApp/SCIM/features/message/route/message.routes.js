const express = require('express');
/**
 * @swagger
 * /api/v1/scim/message:
 *   get:
 *     summary: Lister Message
 *     tags: [SCIM]
 *     responses:
 *       200:
 *         description: Liste Message
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
 *     summary: Creer Message
 *     tags: [SCIM]
 *     responses:
 *       200:
 *         description: Message cree
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
 * /api/v1/scim/message/{id}:
 *   get:
 *     summary: Recuperer Message par ID
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message recupere
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
 *     summary: Mettre a jour Message
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message mis a jour
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
 *     summary: Supprimer Message
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message supprime
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

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');

const contactScim = require('../controller/message.contact.controller');
const getUnreadCount = require('../controller/message.unread.controller');
const getInbox = require('../controller/message.inbox.controller');
const markThreadRead = require('../controller/message.markThreadRead.controller');
const deleteThread = require('../controller/message.deleteThread.controller');
const markMessageRead = require('../controller/message.markRead.controller');
const deleteMessage = require('../controller/message.delete.controller');
const getMessagesWith = require('../controller/message.getWith.controller');
const sendMessage = require('../controller/message.send.controller');






router.post('/scim', protect, contactScim);







router.get('/unread', protect, getUnreadCount);







router.get('/inbox', protect, getInbox);







router.patch('/thread/:userId/read', protect, markThreadRead);







router.delete('/thread/:userId', protect, deleteThread);







router.patch('/:id/read', protect, markMessageRead);







router.delete('/:id', protect, deleteMessage);







router.get('/:userId', protect, getMessagesWith);







router.post('/:receiverId', protect, sendMessage);



module.exports = router;
