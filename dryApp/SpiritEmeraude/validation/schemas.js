const Joi = require('joi');
const { commonSchemas } = require('../../../dry/utils/validation/validation.util');

// Schémas de validation SPÉCIFIQUES à SpiritEmeraude
const spiritEmeraudeSchemas = {
  // Produits de la boutique
  product: {
    create: Joi.object({
      name: commonSchemas.name,
      price: commonSchemas.price.required(),
      category: Joi.string().valid('sac', 'trousse', 'sandale', 'accessoire', 'personnalise', 'saisonnier').required(),
      description: commonSchemas.description.max(500),
      images: Joi.array().items(commonSchemas.url).optional(),
      stock: Joi.number().integer().min(0).default(0),
      materials: Joi.array().items(Joi.string().max(50)).optional(),
      dimensions: Joi.object({
        length: Joi.number().positive().optional(),
        width: Joi.number().positive().optional(),
        height: Joi.number().positive().optional(),
        weight: Joi.number().positive().optional()
      }).optional()
    }),
    
    update: Joi.object({
      name: commonSchemas.name.optional(),
      price: commonSchemas.price.optional(),
      category: Joi.string().valid('sac', 'trousse', 'sandale', 'accessoire', 'personnalise', 'saisonnier').optional(),
      description: commonSchemas.description.max(500).optional(),
      images: Joi.array().items(commonSchemas.url).optional(),
      stock: Joi.number().integer().min(0).optional(),
      materials: Joi.array().items(Joi.string().max(50)).optional(),
      dimensions: Joi.object({
        length: Joi.number().positive().optional(),
        width: Joi.number().positive().optional(),
        height: Joi.number().positive().optional(),
        weight: Joi.number().positive().optional()
      }).optional()
    })
  },

  // Ateliers de création
  atelier: {
    create: Joi.object({
      title: commonSchemas.name,
      description: Joi.string().min(10).max(1000).required(),
      date: commonSchemas.date.min('now').required(),
      duration: Joi.number().integer().min(30).max(480).required(), // en minutes
      maxParticipants: Joi.number().integer().min(1).max(50).required(),
      price: Joi.number().min(0).required(),
      images: Joi.array().items(commonSchemas.url).optional(),
      location: Joi.string().min(5).max(200).required(),
      materialsIncluded: Joi.array().items(Joi.string().max(100)).optional(),
      level: Joi.string().valid('debutant', 'intermediaire', 'avance').default('debutant'),
      instructor: Joi.string().min(2).max(100).required()
    }),
    
    update: Joi.object({
      title: commonSchemas.name.optional(),
      description: Joi.string().min(10).max(1000).optional(),
      date: commonSchemas.date.min('now').optional(),
      duration: Joi.number().integer().min(30).max(480).optional(),
      maxParticipants: Joi.number().integer().min(1).max(50).optional(),
      price: Joi.number().min(0).optional(),
      images: Joi.array().items(commonSchemas.url).optional(),
      location: Joi.string().min(5).max(200).optional(),
      materialsIncluded: Joi.array().items(Joi.string().max(100)).optional(),
      level: Joi.string().valid('debutant', 'intermediaire', 'avance').optional(),
      instructor: Joi.string().min(2).max(100).optional()
    })
  },

  // Formations
  formation: {
    create: Joi.object({
      title: commonSchemas.name,
      description: Joi.string().min(20).max(2000).required(),
      duration: Joi.number().integer().min(60).max(7200).required(), // en minutes
      price: Joi.number().min(0).required(),
      level: Joi.string().valid('debutant', 'intermediaire', 'avance').required(),
      category: Joi.string().valid('couture', 'creation', 'design', 'technique').required(),
      images: Joi.array().items(commonSchemas.url).optional(),
      prerequisites: Joi.array().items(Joi.string().max(200)).optional(),
      objectives: Joi.array().items(Joi.string().max(300)).required(),
      certification: Joi.boolean().default(false)
    }),
    
    update: Joi.object({
      title: commonSchemas.name.optional(),
      description: Joi.string().min(20).max(2000).optional(),
      duration: Joi.number().integer().min(60).max(7200).optional(),
      price: Joi.number().min(0).optional(),
      level: Joi.string().valid('debutant', 'intermediaire', 'avance').optional(),
      category: Joi.string().valid('couture', 'creation', 'design', 'technique').optional(),
      images: Joi.array().items(commonSchemas.url).optional(),
      prerequisites: Joi.array().items(Joi.string().max(200)).optional(),
      objectives: Joi.array().items(Joi.string().max(300)).optional(),
      certification: Joi.boolean().optional()
    })
  },

  // Impact social (Orphelinat)
  impact: {
    create: Joi.object({
      title: commonSchemas.name,
      description: Joi.string().min(20).max(2000).required(),
      category: Joi.string().valid('education', 'sante', 'nutrition', 'logement', 'autre').required(),
      images: Joi.array().items(commonSchemas.url).required(),
      videos: Joi.array().items(commonSchemas.url).optional(),
      amount: Joi.number().positive().required(),
      goal: Joi.number().positive().required(),
      date: commonSchemas.date.required(),
      location: Joi.string().min(5).max(200).required(),
      beneficiaries: Joi.number().integer().min(1).required()
    }),
    
    update: Joi.object({
      title: commonSchemas.name.optional(),
      description: Joi.string().min(20).max(2000).optional(),
      category: Joi.string().valid('education', 'sante', 'nutrition', 'logement', 'autre').optional(),
      images: Joi.array().items(commonSchemas.url).optional(),
      videos: Joi.array().items(commonSchemas.url).optional(),
      amount: Joi.number().positive().optional(),
      goal: Joi.number().positive().optional(),
      date: commonSchemas.date.optional(),
      location: Joi.string().min(5).max(200).optional(),
      beneficiaries: Joi.number().integer().min(1).optional()
    })
  },

  // Galerie photos
  gallery: {
    create: Joi.object({
      title: commonSchemas.name,
      description: commonSchemas.description.max(500),
      images: Joi.array().items(commonSchemas.url).required(),
      category: Joi.string().valid('atelier', 'creation', 'humanitaire', 'autre').required(),
      date: commonSchemas.date.required(),
      tags: Joi.array().items(Joi.string().max(30)).optional()
    }),
    
    update: Joi.object({
      title: commonSchemas.name.optional(),
      description: commonSchemas.description.max(500).optional(),
      images: Joi.array().items(commonSchemas.url).optional(),
      category: Joi.string().valid('atelier', 'creation', 'humanitaire', 'autre').optional(),
      date: commonSchemas.date.optional(),
      tags: Joi.array().items(Joi.string().max(30)).optional()
    })
  },

  // Messages de contact
  contact: {
    create: Joi.object({
      name: commonSchemas.name,
      email: commonSchemas.email,
      phone: commonSchemas.phone.required(),
      subject: Joi.string().min(3).max(200).required(),
      message: Joi.string().min(10).max(2000).required(),
      type: Joi.string().valid('information', 'commande', 'atelier', 'partenariat', 'autre').default('information')
    })
  }
};

module.exports = {
  spiritEmeraudeSchemas
};
