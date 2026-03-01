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
      title: commonSchemas.name.optional(),
      description: Joi.string().min(20).max(2000).optional(),
      type: Joi.string().valid('appartement', 'maison', 'studio', 'villa', 'terrain', 'commerce').optional(),
      price: commonSchemas.price.optional(),
      area: Joi.number().positive().optional(),
      bedrooms: Joi.number().integer().min(0).max(20).optional(),
      bathrooms: Joi.number().integer().min(0).max(10).optional(),
      address: Joi.string().min(5).max(500).optional(),
      city: Joi.string().min(2).max(100).optional(),
      postalCode: Joi.string().pattern(/^\d{5}$/).optional(),
      images: Joi.array().items(commonSchemas.url).optional(),
      features: Joi.object({
        parking: Joi.boolean().optional(),
        balcony: Joi.boolean().optional(),
        garden: Joi.boolean().optional(),
        pool: Joi.boolean().optional(),
        elevator: Joi.boolean().optional(),
        furnished: Joi.boolean().optional(),
        airConditioning: Joi.boolean().optional(),
        heating: Joi.boolean().optional()
      }).optional(),
      energyClass: Joi.string().valid('A', 'B', 'C', 'D', 'E', 'F', 'G').optional(),
      availableFrom: commonSchemas.date.min('now').optional(),
      status: Joi.string().valid('available', 'rented', 'sold', 'under_offer').optional()
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
      status: Joi.string().valid('pending', 'confirmed', 'cancelled', 'completed').optional()
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
