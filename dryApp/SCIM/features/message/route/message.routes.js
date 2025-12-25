const express = require('express');
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
