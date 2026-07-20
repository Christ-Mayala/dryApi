const express = require('express');
const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const create = require('../controller/notes.create.controller');
const getAll = require('../controller/notes.getAll.controller');
const getById = require('../controller/notes.getById.controller');
const update = require('../controller/notes.update.controller');
const remove = require('../controller/notes.delete.controller');
const search = require('../controller/notes.search.controller');

// Bloc-notes 100% prive : toutes les routes exigent une session.
router.use(protect);

router.get('/search', search);
router.get('/', getAll);
router.get('/:id', validateId, getById);
router.post('/', withAudit('NOTES_CREATE'), create);
router.put('/:id', validateId, withAudit('NOTES_UPDATE'), update);
router.delete('/:id', validateId, withAudit('NOTES_DELETE'), remove);

module.exports = router;
