const Joi = require('joi');
const { commonSchemas } = require('../../../dry/utils/validation/validation.util');

const zertySchemas = {
  Severgold: {
    create: Joi.object({
      Mays: Joi.string().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      Mays: Joi.string().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
};

module.exports = { zertySchemas };
