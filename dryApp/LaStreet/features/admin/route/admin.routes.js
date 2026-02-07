const express = require('express');
/**
 * @swagger
 * /api/v1/lastreet/admin:
 *   get:
 *     summary: Lister Admin
 *     tags: [LaStreet]
 *     responses:
 *       200:
 *         description: Liste Admin
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
 *     summary: Creer Admin
 *     tags: [LaStreet]
 *     responses:
 *       200:
 *         description: Admin cree
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
 * /api/v1/lastreet/admin/{id}:
 *   get:
 *     summary: Recuperer Admin par ID
 *     tags: [LaStreet]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Admin recupere
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
 *     summary: Mettre a jour Admin
 *     tags: [LaStreet]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Admin mis a jour
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
 *     summary: Supprimer Admin
 *     tags: [LaStreet]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Admin supprime
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
const { withAudit } = require('../../../../../dry/middlewares/audit');

const getStats = require('../controller/admin.stats.controller');
const listPros = require('../controller/admin.professionals.list.controller');
const getPro = require('../controller/admin.professionals.get.controller');
const updateProStatus = require('../controller/admin.professionals.updateStatus.controller');
const deletePro = require('../controller/admin.professionals.delete.controller');

const listUsers = require('../controller/admin.users.list.controller');
const createUser = require('../controller/admin.users.create.controller');
const deleteUser = require('../controller/admin.users.delete.controller');
const updateUserStatus = require('../controller/admin.users.status.controller');
const sendUserEmail = require('../controller/admin.users.email.controller');

const listAudits = require('../controller/admin.audits.list.controller');
const listReports = require('../controller/admin.reports.list.controller');
const decideReport = require('../controller/admin.reports.decision.controller');

const broadcastEmail = require('../controller/admin.email.broadcast.controller');

router.use(protect);
router.use(authorize('admin'));






router.get('/stats', getStats);







router.get('/professionals', listPros);







router.get('/professionals/:id', getPro);







router.patch('/professionals/:id/status', withAudit('ADMIN_UPDATE_PRO_STATUS'), updateProStatus);







router.delete('/professionals/:id', withAudit('ADMIN_DELETE_PRO'), deletePro);








router.get('/users', listUsers);







router.post('/users', withAudit('ADMIN_CREATE_USER'), createUser);







router.delete('/users/:id', withAudit('ADMIN_DELETE_USER'), deleteUser);







router.patch('/users/:id/status', withAudit('ADMIN_UPDATE_USER_STATUS'), updateUserStatus);







router.post('/users/:id/email', withAudit('ADMIN_SEND_USER_EMAIL'), sendUserEmail);








router.get('/audits', listAudits);








router.get('/reports', listReports);







router.post('/reports/:id/decision', withAudit('ADMIN_REPORT_DECISION'), decideReport);








router.post('/email/broadcast', withAudit('ADMIN_EMAIL_BROADCAST'), broadcastEmail);



module.exports = router;
