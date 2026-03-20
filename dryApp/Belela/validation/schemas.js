const Joi = require('joi');
const { commonSchemas } = require('../../../dry/utils/validation/validation.util');

const belelaSchemas = {
  Post: {
    create: Joi.object({
      titre: Joi.string().required(),
      description: Joi.string().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      titre: Joi.string().optional(),
      description: Joi.string().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
  Annonce: {
    create: Joi.object({
      titre: Joi.string().required(),
      description: Joi.string().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      titre: Joi.string().optional(),
      description: Joi.string().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
};

module.exports = { belelaSchemas };
