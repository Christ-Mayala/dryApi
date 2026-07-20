const Joi = require('joi');
const { commonSchemas } = require('../../../dry/utils/validation/validation.util');

const BIBLE_VERSIONS = ['LSG1910', 'DARBY', 'KJV'];

const pelerinSchemas = {
  BibleVerse: {
    create: Joi.object({
      version: Joi.string().valid(...BIBLE_VERSIONS).required(),
      bookCode: Joi.string().lowercase().required(),
      book: Joi.string().required(),
      testament: Joi.string().valid('AT', 'NT').required(),
      chapter: Joi.number().integer().min(1).required(),
      verse: Joi.number().integer().min(1).required(),
      text: Joi.string().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      version: Joi.string().valid(...BIBLE_VERSIONS).optional(),
      bookCode: Joi.string().lowercase().optional(),
      book: Joi.string().optional(),
      testament: Joi.string().valid('AT', 'NT').optional(),
      chapter: Joi.number().integer().min(1).optional(),
      verse: Joi.number().integer().min(1).optional(),
      text: Joi.string().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
  BibleBook: {
    create: Joi.object({
      code: Joi.string().lowercase().required(),
      nameFr: Joi.string().required(),
      nameEn: Joi.string().required(),
      testament: Joi.string().valid('AT', 'NT').required(),
      order: Joi.number().integer().min(1).max(66).required(),
      chapterCount: Joi.number().integer().min(1).required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      code: Joi.string().lowercase().optional(),
      nameFr: Joi.string().optional(),
      nameEn: Joi.string().optional(),
      testament: Joi.string().valid('AT', 'NT').optional(),
      order: Joi.number().integer().min(1).max(66).optional(),
      chapterCount: Joi.number().integer().min(1).optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  }
};

module.exports = { pelerinSchemas, BIBLE_VERSIONS };
