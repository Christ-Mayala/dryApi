const { validate } = require('../../../dry/utils/validation/validation.util');
const { laStreetSchemas } = require('./schemas');

// Middlewares de validation spécifiques à LaStreet
const validateLaStreet = {
  // Professionnels/Services
  professional: {
    create: validate(laStreetSchemas.professional.create),
    update: validate(laStreetSchemas.professional.update)
  },

  // Catégories
  category: {
    create: validate(laStreetSchemas.category.create),
    update: validate(laStreetSchemas.category.update)
  },

  // Signalements/Rapports
  report: {
    create: validate(laStreetSchemas.report.create),
    update: validate(laStreetSchemas.report.update)
  },

  // Administration
  admin: {
    userManagement: {
      create: validate(laStreetSchemas.admin.userManagement.create),
      update: validate(laStreetSchemas.admin.userManagement.update)
    }
  }
};

module.exports = {
  validateLaStreet
};
