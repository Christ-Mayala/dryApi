const Joi = require('joi');
const { commonSchemas } = require('../../../dry/utils/validation/validation.util');

// Schémas de validation SPÉCIFIQUES à LaStreet
const laStreetSchemas = {
  // Professionnels/Services
  professional: {
    create: Joi.object({
      name: commonSchemas.name,
      category: Joi.string().valid('plombier', 'electricien', 'menuisier', 'peintre', 'jardinier', 'nettoyage', 'autre').required(),
      description: Joi.string().min(20).max(2000).required(),
      phone: commonSchemas.phone.required(),
      email: commonSchemas.email.required(),
      address: Joi.string().min(5).max(500).required(),
      city: Joi.string().min(2).max(100).required(),
      postalCode: Joi.string().pattern(/^\d{5}$/).required().messages({
        'string.pattern.base': 'Code postal invalide'
      }),
      website: commonSchemas.url.optional(),
      services: Joi.array().items(Joi.string().max(100)).required(),
      experience: Joi.number().integer().min(0).max(50).required(), // années d'expérience
      availability: Joi.string().valid('immediate', 'semaine', 'mois').default('immediate'),
      certified: Joi.boolean().default(false),
      images: Joi.array().items(commonSchemas.url).optional(),
      operatingHours: Joi.object({
        monday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        tuesday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        wednesday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        thursday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        friday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        saturday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        sunday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional()
      }).optional()
    }),
    
    update: Joi.object({
      name: commonSchemas.name.optional(),
      category: Joi.string().valid('plombier', 'electricien', 'menuisier', 'peintre', 'jardinier', 'nettoyage', 'autre').optional(),
      description: Joi.string().min(20).max(2000).optional(),
      phone: commonSchemas.phone.optional(),
      email: commonSchemas.email.optional(),
      address: Joi.string().min(5).max(500).optional(),
      city: Joi.string().min(2).max(100).optional(),
      postalCode: Joi.string().pattern(/^\d{5}$/).optional(),
      website: commonSchemas.url.optional(),
      services: Joi.array().items(Joi.string().max(100)).optional(),
      experience: Joi.number().integer().min(0).max(50).optional(),
      availability: Joi.string().valid('immediate', 'semaine', 'mois').optional(),
      certified: Joi.boolean().optional(),
      images: Joi.array().items(commonSchemas.url).optional(),
      operatingHours: Joi.object({
        monday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        tuesday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        wednesday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        thursday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        friday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        saturday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        sunday: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional()
      }).optional()
    })
  },

  // Catégories de services
  category: {
    create: Joi.object({
      name: commonSchemas.name,
      description: commonSchemas.description.max(500),
      icon: commonSchemas.url.optional(),
      color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).messages({
        'string.pattern.base': 'Couleur invalide (format hex #RRGGBB requis)'
      }),
      parentCategory: commonSchemas.objectId.optional()
    }),
    
    update: Joi.object({
      name: commonSchemas.name.optional(),
      description: commonSchemas.description.max(500).optional(),
      icon: commonSchemas.url.optional(),
      color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
      parentCategory: commonSchemas.objectId.optional()
    })
  },

  // Signalements/Rapports
  report: {
    create: Joi.object({
      type: Joi.string().valid('nuisance', 'degradation', 'danger', 'proprete', 'autre').required(),
      title: commonSchemas.name,
      description: Joi.string().min(10).max(2000).required(),
      location: Joi.string().min(5).max(500).required(),
      city: Joi.string().min(2).max(100).required(),
      urgency: Joi.string().valid('basse', 'moyenne', 'haute', 'critique').default('moyenne'),
      images: Joi.array().items(commonSchemas.url).optional(),
      coordinates: Joi.object({
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required()
      }).optional(),
      anonymous: Joi.boolean().default(false),
      contactInfo: Joi.when('anonymous', {
        is: false,
        then: Joi.object({
          phone: commonSchemas.phone.required(),
          email: commonSchemas.email.required()
        }).required(),
        otherwise: Joi.optional()
      })
    }),
    
    update: Joi.object({
      title: commonSchemas.name.optional(),
      description: Joi.string().min(10).max(2000).optional(),
      location: Joi.string().min(5).max(500).optional(),
      city: Joi.string().min(2).max(100).optional(),
      urgency: Joi.string().valid('basse', 'moyenne', 'haute', 'critique').optional(),
      images: Joi.array().items(commonSchemas.url).optional(),
      coordinates: Joi.object({
        latitude: Joi.number().min(-90).max(90).optional(),
        longitude: Joi.number().min(-180).max(180).optional()
      }).optional(),
      status: Joi.string().valid('soumis', 'en_cours', 'resolu', 'cloture').optional()
    })
  },

  // Administration
  admin: {
    userManagement: {
      create: Joi.object({
        name: commonSchemas.name,
        email: commonSchemas.email,
        role: Joi.string().valid('admin', 'moderator', 'user').required(),
        permissions: Joi.array().items(Joi.string().valid('manage_users', 'manage_reports', 'manage_categories', 'view_analytics')).optional()
      }),
      
      update: Joi.object({
        name: commonSchemas.name.optional(),
        role: Joi.string().valid('admin', 'moderator', 'user').optional(),
        permissions: Joi.array().items(Joi.string().valid('manage_users', 'manage_reports', 'manage_categories', 'view_analytics')).optional(),
        status: Joi.string().valid('active', 'suspended', 'banned').optional()
      })
    }
  }
};

module.exports = {
  laStreetSchemas
};
