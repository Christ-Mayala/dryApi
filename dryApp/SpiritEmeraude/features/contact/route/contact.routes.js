const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');

const sendMessage = require('../controller/contact.send.controller');
const listMessages = require('../controller/contact.list.controller');
const deleteMessage = require('../controller/contact.delete.controller');

router.post('/', sendMessage);
router.get('/', protect, authorize('admin'), listMessages);
router.delete('/:id', protect, authorize('admin'), deleteMessage);

module.exports = router;