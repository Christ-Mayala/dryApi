const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const create = require('../controller/quiz.create.controller');
const getAll = require('../controller/quiz.getAll.controller');
const getById = require('../controller/quiz.getById.controller');
const getByIdAdmin = require('../controller/quiz.getByIdAdmin.controller');
const update = require('../controller/quiz.update.controller');
const remove = require('../controller/quiz.delete.controller');
const answer = require('../controller/quiz.answer.controller');
const stats = require('../controller/quiz.stats.controller');

// Routes specifiques AVANT /:id.
router.get('/stats', protect, stats);
router.get('/admin/:id', protect, authorize('admin'), validateId, getByIdAdmin);

router.get('/', getAll);
router.get('/:id', validateId, getById);
router.post('/:id/answer', protect, validateId, withAudit('QUIZ_ANSWER'), answer);

router.post('/', protect, authorize('admin'), withAudit('QUIZ_CREATE'), create);
router.put('/:id', protect, authorize('admin'), validateId, withAudit('QUIZ_UPDATE'), update);
router.delete('/:id', protect, authorize('admin'), validateId, withAudit('QUIZ_DELETE'), remove);

module.exports = router;
