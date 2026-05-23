// Validation schemas for FreeLLM API
const Joi = require('joi');

const modelsSchema = Joi.object({
  platform: Joi.string().required(),
  modelId: Joi.string().required(),
  displayName: Joi.string().required(),
  intelligenceRank: Joi.number().required(),
  speedRank: Joi.number().required(),
  sizeLabel: Joi.string().required(),
  rpmLimit: Joi.number().allow(null),
  rpdLimit: Joi.number().allow(null),
  tpmLimit: Joi.number().allow(null),
  tpdLimit: Joi.number().allow(null),
  monthlyTokenBudget: Joi.string().default(''),
  contextWindow: Joi.number().allow(null),
  enabled: Joi.boolean().default(true)
});

const apiKeysSchema = Joi.object({
  platform: Joi.string().required(),
  label: Joi.string().default(''),
  encryptedKey: Joi.string().required(),
  iv: Joi.string().required(),
  authTag: Joi.string().required(),
  status: Joi.string().default('unknown'),
  enabled: Joi.boolean().default(true)
});

const requestsSchema = Joi.object({
  platform: Joi.string().required(),
  modelId: Joi.string().required(),
  status: Joi.string().required(),
  inputTokens: Joi.number().default(0),
  outputTokens: Joi.number().default(0),
  latencyMs: Joi.number().default(0),
  error: Joi.string().allow(null)
});

module.exports = {
  modelsSchema,
  apiKeysSchema,
  requestsSchema
};
