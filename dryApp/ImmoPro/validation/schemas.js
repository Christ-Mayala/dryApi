const Joi = require('joi');
const { commonSchemas } = require('../../../dry/utils/validation/validation.util');

const immoProSchemas = {
  Bien: {
    create: Joi.object({
      titre: Joi.string().required(),
      description: Joi.string().required(),
      prix: Joi.number().required(),
      type: Joi.string().required(),
      surface: Joi.number().required(),
      chambres: Joi.number().required(),
      sallesDeBain: Joi.number().required(),
      adresse: Joi.string().required(),
      ville: Joi.string().required(),
      codePostal: Joi.string().required(),
      disponible: Joi.boolean().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      titre: Joi.string().optional(),
      description: Joi.string().optional(),
      prix: Joi.number().optional(),
      type: Joi.string().optional(),
      surface: Joi.number().optional(),
      chambres: Joi.number().optional(),
      sallesDeBain: Joi.number().optional(),
      adresse: Joi.string().optional(),
      ville: Joi.string().optional(),
      codePostal: Joi.string().optional(),
      disponible: Joi.boolean().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
  Visite: {
    create: Joi.object({
      bienId: Joi.string().required(),
      clientId: Joi.string().required(),
      dateVisite: commonSchemas.date.required(),
      statut: Joi.string().required(),
      commentaire: Joi.string().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      bienId: Joi.string().optional(),
      clientId: Joi.string().optional(),
      dateVisite: commonSchemas.date.optional(),
      statut: Joi.string().optional(),
      commentaire: Joi.string().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
  Client: {
    create: Joi.object({
      nom: Joi.string().required(),
      email: commonSchemas.email.required(),
      telephone: Joi.string().required(),
      budget: Joi.number().required(),
      recherche: Joi.string().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      nom: Joi.string().optional(),
      email: commonSchemas.email.optional(),
      telephone: Joi.string().optional(),
      budget: Joi.number().optional(),
      recherche: Joi.string().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
};

module.exports = { immoProSchemas };
