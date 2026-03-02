const Joi = require('joi');
const { commonSchemas } = require('../../../dry/utils/validation/validation.util');

// Schémas de validation SPÉCIFIQUES à SCIM
const scimSchemas = {
  // Propriétés immobilières
  property: {
    create: Joi.object({
      titre: commonSchemas.name,
      description: Joi.string().min(20).max(2000).required(),
      transactionType: Joi.string().valid('location', 'vente').required(),
      prix: commonSchemas.price.required(),
      superficie: Joi.number().positive().optional(),
      nombre_chambres: Joi.number().integer().min(0).max(20).optional(),
      nombre_salles_bain: Joi.number().integer().min(0).max(10).optional(),
      adresse: Joi.string().min(5).max(500).required(),
      ville: Joi.string().min(2).max(100).required(),
      images: Joi.array().items(Joi.object({
        url: Joi.string().required(),
        public_id: Joi.string().required()
      })).optional(),
      devise: Joi.string().default('XAF'),
      categorie: Joi.string().valid('Appartement', 'Maison', 'Hôtel', 'Terrain', 'Commercial', 'Autre').default('Autre'),
      status: Joi.string().valid('active', 'inactive').default('active'),
      isBonPlan: Joi.boolean().default(false),
      bonPlanLabel: Joi.string().optional(),
      bonPlanExpiresAt: Joi.date().optional(),
      prixOriginal: Joi.number().optional(),
      garage: Joi.boolean().default(false),
      gardien: Joi.boolean().default(false),
      balcon: Joi.boolean().default(false),
      piscine: Joi.boolean().default(false),
      jardin: Joi.boolean().default(false),
      nombre_salons: Joi.number().integer().min(0).optional()
    }),
    
    update: Joi.object({
      titre: commonSchemas.name.optional(),
      description: Joi.string().min(20).max(2000).optional(),
      transactionType: Joi.string().valid('location', 'vente').optional(),
      prix: commonSchemas.price.optional(),
      prixOriginal: Joi.number().optional(),
      devise: Joi.string().optional(),
      superficie: Joi.number().positive().optional(),
      nombre_chambres: Joi.number().integer().min(0).max(20).optional(),
      nombre_salles_bain: Joi.number().integer().min(0).max(10).optional(),
      nombre_salons: Joi.number().integer().min(0).optional(),
      adresse: Joi.string().min(5).max(500).optional(),
      ville: Joi.string().min(2).max(100).optional(),
      categorie: Joi.string().valid('Appartement', 'Maison', 'Hôtel', 'Terrain', 'Commercial', 'Autre').optional(),
      status: Joi.string().valid('active', 'inactive').optional(),
      isBonPlan: Joi.boolean().optional(),
      bonPlanLabel: Joi.string().optional(),
      bonPlanExpiresAt: Joi.date().optional(),
      garage: Joi.boolean().optional(),
      gardien: Joi.boolean().optional(),
      balcon: Joi.boolean().optional(),
      piscine: Joi.boolean().optional(),
      jardin: Joi.boolean().optional(),
      images: Joi.array().items(Joi.object({
        url: Joi.string().required(),
        public_id: Joi.string().required()
      })).optional()
    })
  },

  // Réservations
  reservation: {
    create: Joi.object({
      propertyId: commonSchemas.objectId.required(),
      startDate: commonSchemas.date.min('now').required(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).required().messages({
        'date.min': 'La date de fin doit être après la date de début'
      }),
      numberOfGuests: Joi.number().integer().min(1).max(20).required(),
      message: commonSchemas.description.max(1000).optional(),
      type: Joi.string().valid('visit', 'rental', 'purchase').required()
    }),
    
    update: Joi.object({
      startDate: commonSchemas.date.min('now').optional(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
      numberOfGuests: Joi.number().integer().min(1).max(20).optional(),
      message: commonSchemas.description.max(1000).optional(),
      status: Joi.string().valid('en_attente', 'confirmee', 'annulee', 'terminee').optional()
    })
  },

  // Messages entre utilisateurs
  message: {
    create: Joi.object({
      recipientId: commonSchemas.objectId.required(),
      propertyId: commonSchemas.objectId.optional(),
      subject: Joi.string().min(3).max(200).required(),
      content: Joi.string().min(10).max(2000).required(),
      type: Joi.string().valid('inquiry', 'offer', 'information', 'appointment').default('inquiry')
    }),
    
    update: Joi.object({
      subject: Joi.string().min(3).max(200).optional(),
      content: Joi.string().min(10).max(2000).optional(),
      read: Joi.boolean().optional()
    })
  },

  // Favoris
  favoris: {
    create: Joi.object({
      propertyId: commonSchemas.objectId.required(),
      notes: commonSchemas.description.max(500).optional()
    }),
    
    update: Joi.object({
      notes: commonSchemas.description.max(500).optional()
    })
  },

  // Utilisateurs SCIM (profil étendu)
  userProfile: {
    create: Joi.object({
      firstName: commonSchemas.name,
      lastName: commonSchemas.name,
      phone: commonSchemas.phone.required(),
      bio: commonSchemas.description.max(1000).optional(),
      preferences: Joi.object({
        propertyTypes: Joi.array().items(Joi.string().valid('appartement', 'maison', 'studio', 'villa', 'terrain', 'commerce')).optional(),
        priceRange: Joi.object({
          min: Joi.number().min(0).optional(),
          max: Joi.number().positive().optional()
        }).optional(),
        locations: Joi.array().items(Joi.string().max(100)).optional(),
        notifications: Joi.boolean().default(true)
      }).optional()
    }),
    
    update: Joi.object({
      firstName: commonSchemas.name.optional(),
      lastName: commonSchemas.name.optional(),
      phone: commonSchemas.phone.optional(),
      bio: commonSchemas.description.max(1000).optional(),
      preferences: Joi.object({
        propertyTypes: Joi.array().items(Joi.string().valid('appartement', 'maison', 'studio', 'villa', 'terrain', 'commerce')).optional(),
        priceRange: Joi.object({
          min: Joi.number().min(0).optional(),
          max: Joi.number().positive().optional()
        }).optional(),
        locations: Joi.array().items(Joi.string().max(100)).optional(),
        notifications: Joi.boolean().optional()
      }).optional()
    })
  }
};

module.exports = {
  scimSchemas
};
