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
  },
  readingPlan: {
    create: Joi.object({
      title: Joi.string().min(2).max(200).required(),
      description: Joi.string().max(1000).required(),
      theme: Joi.string().max(100).optional(),
      icon: Joi.string().max(100).optional(),
      durationDays: Joi.number().integer().min(1).max(365).required(),
      isPublished: Joi.boolean().optional(),
      days: Joi.array().items(
        Joi.object({
          day: Joi.number().integer().min(1).max(365).required(),
          bookCode: Joi.string().lowercase().required(),
          chapter: Joi.number().integer().min(1).required(),
          verseStart: Joi.number().integer().min(1).optional(),
          verseEnd: Joi.number().integer().min(1).optional(),
          theme: Joi.string().max(100).optional(),
          reflection: Joi.string().max(1000).optional(),
          estimatedMinutes: Joi.number().integer().min(1).optional(),
          label: Joi.string().max(200).optional(),
        })
      ).optional(),
      label: Joi.string().min(2).max(200).optional()
    }),
    update: Joi.object({
      title: Joi.string().min(2).max(200).optional(),
      description: Joi.string().max(1000).optional(),
      theme: Joi.string().max(100).optional(),
      icon: Joi.string().max(100).optional(),
      durationDays: Joi.number().integer().min(1).max(365).optional(),
      isPublished: Joi.boolean().optional(),
      days: Joi.array().items(
        Joi.object({
          day: Joi.number().integer().min(1).max(365).required(),
          bookCode: Joi.string().lowercase().required(),
          chapter: Joi.number().integer().min(1).required(),
          verseStart: Joi.number().integer().min(1).optional(),
          verseEnd: Joi.number().integer().min(1).optional(),
          theme: Joi.string().max(100).optional(),
          reflection: Joi.string().max(1000).optional(),
          estimatedMinutes: Joi.number().integer().min(1).optional(),
          label: Joi.string().max(200).optional(),
        })
      ).optional(),
      label: Joi.string().min(2).max(200).optional()
    })
  },
  userJourney: {
    upsert: Joi.object({
      points: Joi.number().integer().min(0).optional(),
      currentStageKey: Joi.string().max(100).optional(),
      completedMilestones: Joi.array().items(Joi.string().max(100)).optional(),
      streakDays: Joi.number().integer().min(0).optional(),
      lastActiveDate: Joi.date().optional(),
      readingPlanDay: Joi.number().integer().min(1).max(365).optional(),
      readingPlanId: Joi.string().max(100).optional(),
      label: Joi.string().min(2).max(200).optional()
    })
  }
};

module.exports = { pelerinSchemas, BIBLE_VERSIONS };
