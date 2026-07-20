const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { cache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const create = require('../controller/temoignage.create.controller');
const getAll = require('../controller/temoignage.getAll.controller');
const getMine = require('../controller/temoignage.getMine.controller');
const getPending = require('../controller/temoignage.getPending.controller');
const getById = require('../controller/temoignage.getById.controller');
const update = require('../controller/temoignage.update.controller');
const remove = require('../controller/temoignage.delete.controller');

// Lecture publique (temoignages approuves uniquement).
router.get('/', cache(120), getAll);
// Routes specifiques AVANT /:id pour ne pas etre interceptees par le param.
router.get('/mine', protect, getMine);
router.get('/pending', protect, authorize('admin'), getPending);
router.get('/:id', validateId, getById);

router.post('/', protect, withAudit('TEMOIGNAGE_CREATE'), create);
router.put('/:id', protect, validateId, withAudit('TEMOIGNAGE_UPDATE'), update);
router.delete('/:id', protect, validateId, withAudit('TEMOIGNAGE_DELETE'), remove);

module.exports = router;
