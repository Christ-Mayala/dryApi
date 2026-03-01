const Joi = require('joi');

// Schémas de validation COMMUNS à toutes les applications
const commonSchemas = {
  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().optional(),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // ID MongoDB
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'ID invalide'
  }),

  // Email
  email: Joi.string().email().required().messages({
    'string.email': 'Email invalide'
  }),

  // Mot de passe
  password: Joi.string().min(6).required().messages({
    'string.min': 'Le mot de passe doit contenir au moins 6 caractères'
  }),

  // Nom
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Le nom doit contenir au moins 2 caractères',
    'string.max': 'Le nom ne peut pas dépasser 100 caractères'
  }),

  // Téléphone
  phone: Joi.string().pattern(/^[+]?[\d\s-()]{10,}$/).messages({
    'string.pattern.base': 'Numéro de téléphone invalide'
  }),

  // Description
  description: Joi.string().max(2000).optional(),

  // URL
  url: Joi.string().uri().optional(),

  // Prix
  price: Joi.number().positive().messages({
    'number.positive': 'Le prix doit être positif'
  }),

  // Date
  date: Joi.date().iso().messages({
    'date.format': 'Format de date invalide (ISO requis)'
  }),

  // Statut
  status: Joi.string().valid('active', 'inactive', 'pending', 'deleted').default('active')
};

// Middleware de validation générique
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      console.error('Validation Error Details:', JSON.stringify(error.details, null, 2));
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors
      });
    }

    // Remplacer les données par les données validées et nettoyées
    req[source] = value;
    next();
  };
};

// Validation des paramètres ID
const validateId = (req, res, next) => {
  const { error } = commonSchemas.objectId.validate(req.params.id);

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'ID invalide',
      error: error.message
    });
  }

  next();
};

module.exports = {
  commonSchemas,
  validate,
  validateId
};
