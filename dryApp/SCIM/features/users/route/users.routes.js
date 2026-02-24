const express = require('express');
/**
 * @swagger
 * /api/v1/scim/users:
 *   get:
 *     summary: Lister Users
 *     tags: [SCIM]
 *     responses:
 *       200:
 *         description: Liste Users
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
 *     summary: Creer Users
 *     tags: [SCIM]
 *     responses:
 *       200:
 *         description: Users cree
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
 * /api/v1/scim/users/{id}:
 *   get:
 *     summary: Recuperer Users par ID
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Users recupere
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
 *     summary: Mettre a jour Users
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Users mis a jour
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
 *     summary: Supprimer Users
 *     tags: [SCIM]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Users supprime
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

const register = require('../controller/users.register.controller');
const login = require('../controller/users.login.controller');
const logout = require('../controller/users.logout.controller');
const refreshToken = require('../controller/users.refresh.controller');
const profile = require('../controller/users.profile.controller');
const getVisited = require('../controller/users.visited.controller');
const getUserStats = require('../controller/users.stats.controller');
const searchUsers = require('../controller/users.search.controller');
const updateUser = require('../controller/users.update.controller');
const changePassword = require('../controller/users.changePassword.controller');
const resetRequest = require('../controller/users.resetRequest.controller');
const resetVerify = require('../controller/users.resetVerify.controller');
const resetPassword = require('../controller/users.resetPassword.controller');






router.post('/register', register);







router.post('/login', login);







router.post('/logout', logout);







router.post('/refresh-token', refreshToken);







router.post('/reset-request', resetRequest);







router.post('/reset-verify', resetVerify);







router.post('/reset-password', resetPassword);








router.get('/profil', protect, profile);
router.get('/profile', protect, profile);







router.get('/visited', protect, getVisited);







router.get('/stats', protect, getUserStats);







router.get('/search', protect, searchUsers);







router.put('/:id', protect, updateUser);







router.patch('/:id/password', protect, changePassword);



module.exports = router;
