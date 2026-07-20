const Joi = require('joi');
const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validate } = require('../../../../../dry/utils/validation/validation.util');
const ParcoursSchema = require('../model/parcours.schema');

const stepSchema = Joi.object({
  order: Joi.number().integer().min(1).required(),
  title: Joi.string().required(),
  bookCode: Joi.string().lowercase().optional(),
  chapter: Joi.number().integer().optional(),
  verseStart: Joi.number().integer().optional(),
  verseEnd: Joi.number().integer().optional(),
  meditation: Joi.string().allow('').optional(),
  reflectionQuestion: Joi.string().allow('').optional(),
  practicalExercise: Joi.string().allow('').optional(),
});

const createSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  theme: Joi.string().optional(),
  icon: Joi.string().optional(),
  estimatedDays: Joi.number().integer().min(1).optional(),
  isPublished: Joi.boolean().optional(),
  steps: Joi.array().items(stepSchema).optional(),
});

const updateSchema = createSchema.fork(['title', 'description'], (s) => s.optional());

// Parcours spirituels : lecture publique (pour que chacun puisse decouvrir/commencer
// sans etre connecte), ecriture reservee a l'admin.
const router = buildCrudRouter('Parcours', ParcoursSchema, {
  auth: { create: 'admin', update: 'admin', delete: 'admin' },
  caching: { list: 300, get: 600 },
  validation: { create: validate(createSchema), update: validate(updateSchema) },
});

module.exports = router;
