const Joi = require('joi');
const { commonSchemas } = require('../../../dry/utils/validation/validation.util');

const urlSchema = Joi.string().uri({ scheme: ['http', 'https'] });

const mediaDLSchemas = {
  Downloads: {
    create: Joi.object({
      url: urlSchema.required(),
      mediaType: Joi.string().valid('video', 'audio', 'image').required(),
      filename: Joi.string().allow('', null),
      qualityMode: Joi.string().valid('smooth', 'max', 'audio').default('smooth'),
      maxHeight: Joi.number().min(144).max(4320).optional(),
      presetId: Joi.string().optional(),
      batchId: Joi.string().optional(),
      label: Joi.string().allow('', null)
    }),
    update: Joi.object({
      jobStatus: Joi.string().valid('pending', 'running', 'done', 'error', 'cancelled').optional(),
      progress: Joi.number().min(0).max(100).optional(),
      error: Joi.string().optional(),
      sizeBytes: Joi.number().optional(),
      path: Joi.string().optional(),
      expiresAt: commonSchemas.date.optional(),
      finishedAt: commonSchemas.date.optional()
    })
  },
  Batches: {
    create: Joi.object({
      label: Joi.string().required(),
      sourceType: Joi.string().required(),
      total: Joi.number().required(),
      completed: Joi.number().required(),
      failed: Joi.number().required(),
      createdBy: Joi.string().optional(),
      startedAt: commonSchemas.date.required(),
      finishedAt: commonSchemas.date.required(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      label: Joi.string().optional(),
      sourceType: Joi.string().optional(),
      total: Joi.number().optional(),
      completed: Joi.number().optional(),
      failed: Joi.number().optional(),
      createdBy: Joi.string().optional(),
      startedAt: commonSchemas.date.optional(),
      finishedAt: commonSchemas.date.optional(),
      status: commonSchemas.status.optional()
    })
  },
  Presets: {
    create: Joi.object({
      label: Joi.string().required(),
      qualityMode: Joi.string().required(),
      preferAudioOnly: Joi.boolean().required(),
      maxHeight: Joi.number().required(),
      downloadDir: Joi.string().required(),
      concurrent: Joi.number().required(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      label: Joi.string().optional(),
      qualityMode: Joi.string().optional(),
      preferAudioOnly: Joi.boolean().optional(),
      maxHeight: Joi.number().optional(),
      downloadDir: Joi.string().optional(),
      concurrent: Joi.number().optional(),
      status: commonSchemas.status.optional()
    })
  }
};

module.exports = { mediaDLSchemas };

