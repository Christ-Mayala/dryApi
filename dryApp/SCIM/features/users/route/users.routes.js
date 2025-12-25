const express = require('express');
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
router.get('/visited', protect, getVisited);
router.get('/stats', protect, getUserStats);
router.get('/search', protect, searchUsers);
router.put('/:id', protect, updateUser);
router.patch('/:id/password', protect, changePassword);

module.exports = router;
