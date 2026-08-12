const express = require('express');
const Joi = require('joi');
const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validate } = require('../../../../../dry/utils/validation/validation.util');
const { cache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const MeditationSchema = require('../model/meditation.schema');

const today = require('../controller/meditation.today.controller');

const createSchema = Joi.object({
  title: Joi.string().required(),
  bookCode: Joi.string().lowercase().required(),
  chapter: Joi.number().integer().required(),
  verseStart: Joi.number().integer().required(),
  verseEnd: Joi.number().integer().optional(),
  reflection: Joi.string().required(),
  prayer: Joi.string().required(),
  publishDate: Joi.date().optional(),
});
const updateSchema = createSchema.fork(
  ['title', 'bookCode', 'chapter', 'verseStart', 'reflection', 'prayer'],
  (s) => s.optional(),
);

// Meditations quotidiennes : lecture publique (méditation du jour + liste),
// ecriture reservee a l'admin.
const crudRouter = buildCrudRouter('Meditation', MeditationSchema, {
  auth: { create: 'admin', update: 'admin', delete: 'admin' },
  caching: { list: 300, get: 600 },
  validation: { create: validate(createSchema), update: validate(updateSchema) },
});

// /today doit être évalué AVANT /:id du CRUD : sinon "/today" serait capturé
// comme un id mongoose. On utilise donc un routeur parent qui monte /today en
// premier, puis le CRUD (/, /:id, POST, PUT, DELETE) enfant ensuite.
const router = express.Router();
/**
 * @swagger
 * /api/v1/pelerin/meditation/today:
 *   get:
 *     summary: Méditation du jour (rotation quotidienne déterministe)
 *     tags: [Pelerin - Méditation]
 *     responses:
 *       200:
 *         description: Méditation sélectionnée pour le jour J
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 */
router.get('/today', cache(60), today);
router.use(crudRouter);

module.exports = router;
