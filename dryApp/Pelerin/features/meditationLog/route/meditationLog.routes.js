const express = require('express');
const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const create = require('../controller/meditationLog.create.controller');
const getAll = require('../controller/meditationLog.getAll.controller');
const remove = require('../controller/meditationLog.delete.controller');

router.use(protect);

router.get('/', getAll);
router.post('/', withAudit('MEDITATIONLOG_CREATE'), create);
router.delete('/:id', validateId, withAudit('MEDITATIONLOG_DELETE'), remove);

module.exports = router;
