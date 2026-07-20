const Joi = require('joi');
const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validate } = require('../../../../../dry/utils/validation/validation.util');
const DevPersonnelSchema = require('../model/devPersonnel.schema');

const THEMES = DevPersonnelSchema.statics.THEMES;

const createSchema = Joi.object({
  title: Joi.string().required(),
  theme: Joi.string().valid(...THEMES).required(),
  content: Joi.string().required(),
  bookCode: Joi.string().lowercase().optional(),
  chapter: Joi.number().integer().optional(),
  verseStart: Joi.number().integer().optional(),
  verseEnd: Joi.number().integer().optional(),
});
const updateSchema = createSchema.fork(['title', 'theme', 'content'], (s) => s.optional());

// Developpement personnel chretien, organise par theme : lecture publique, ecriture admin.
const router = buildCrudRouter('DevPersonnel', DevPersonnelSchema, {
  auth: { create: 'admin', update: 'admin', delete: 'admin' },
  caching: { list: 300, get: 600 },
  validation: { create: validate(createSchema), update: validate(updateSchema) },
});

module.exports = router;
