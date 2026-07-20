const Joi = require('joi');
const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validate } = require('../../../../../dry/utils/validation/validation.util');
const MeditationSchema = require('../model/meditation.schema');

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

// Meditations quotidiennes : lecture publique, ecriture admin.
const router = buildCrudRouter('Meditation', MeditationSchema, {
  auth: { create: 'admin', update: 'admin', delete: 'admin' },
  caching: { list: 300, get: 600 },
  validation: { create: validate(createSchema), update: validate(updateSchema) },
});

module.exports = router;
