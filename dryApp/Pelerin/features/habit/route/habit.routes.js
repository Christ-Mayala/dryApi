const express = require('express');
const router = express.Router();

const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { withAudit } = require('../../../../../dry/middlewares/audit');

const create = require('../controller/habit.create.controller');
const getAll = require('../controller/habit.getAll.controller');
const update = require('../controller/habit.update.controller');
const remove = require('../controller/habit.delete.controller');

// 100% prive : chacun ne voit que ses propres habitudes.
router.use(protect);

router.get('/', getAll);
router.post('/', withAudit('HABIT_CREATE'), create);
router.put('/:id', validateId, withAudit('HABIT_UPDATE'), update);
router.delete('/:id', validateId, withAudit('HABIT_DELETE'), remove);

module.exports = router;
