const { validate } = require('../../../dry/utils/validation/validation.util');
const { scimSchemas } = require('./schemas');

// Middlewares de validation spécifiques à SCIM
const validateSCIM = {
  // Propriétés immobilières
  property: {
    create: validate(scimSchemas.property.create),
    update: validate(scimSchemas.property.update)
  },

  // Réservations
  reservation: {
    create: validate(scimSchemas.reservation.create),
    update: validate(scimSchemas.reservation.update)
  },

  // Messages
  message: {
    create: validate(scimSchemas.message.create),
    update: validate(scimSchemas.message.update)
  },

  // Favoris
  favoris: {
    create: validate(scimSchemas.favoris.create),
    update: validate(scimSchemas.favoris.update)
  },

  // Profils utilisateurs
  userProfile: {
    create: validate(scimSchemas.userProfile.create),
    update: validate(scimSchemas.userProfile.update)
  }
};

module.exports = {
  validateSCIM
};
