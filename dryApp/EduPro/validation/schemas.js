const Joi = require('joi');
const { commonSchemas } = require('../../../dry/utils/validation/validation.util');

const eduProSchemas = {
  Etudiant: {
    create: Joi.object({
      nom: Joi.string().required(),
      prenom: Joi.string().required(),
      email: commonSchemas.email.required(),
      telephone: Joi.string().required(),
      niveau: Joi.string().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      nom: Joi.string().optional(),
      prenom: Joi.string().optional(),
      email: commonSchemas.email.optional(),
      telephone: Joi.string().optional(),
      niveau: Joi.string().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
  Cours: {
    create: Joi.object({
      titre: Joi.string().required(),
      description: Joi.string().required(),
      niveau: Joi.string().required(),
      duree: Joi.number().required(),
      prix: Joi.number().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      titre: Joi.string().optional(),
      description: Joi.string().optional(),
      niveau: Joi.string().optional(),
      duree: Joi.number().optional(),
      prix: Joi.number().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
  Inscription: {
    create: Joi.object({
      etudiantId: Joi.string().required(),
      coursId: Joi.string().required(),
      dateInscription: commonSchemas.date.required(),
      statut: Joi.string().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      etudiantId: Joi.string().optional(),
      coursId: Joi.string().optional(),
      dateInscription: commonSchemas.date.optional(),
      statut: Joi.string().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
};

module.exports = { eduProSchemas };
