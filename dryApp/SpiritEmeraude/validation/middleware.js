const { validate } = require('../../../dry/utils/validation/validation.util');
const { spiritEmeraudeSchemas } = require('./schemas');

// Middlewares de validation spécifiques à SpiritEmeraude
const validateSpiritEmeraude = {
  // Produits
  product: {
    create: validate(spiritEmeraudeSchemas.product.create),
    update: validate(spiritEmeraudeSchemas.product.update)
  },

  // Ateliers
  atelier: {
    create: validate(spiritEmeraudeSchemas.atelier.create),
    update: validate(spiritEmeraudeSchemas.atelier.update)
  },

  // Formations
  formation: {
    create: validate(spiritEmeraudeSchemas.formation.create),
    update: validate(spiritEmeraudeSchemas.formation.update)
  },

  // Impact social
  impact: {
    create: validate(spiritEmeraudeSchemas.impact.create),
    update: validate(spiritEmeraudeSchemas.impact.update)
  },

  // Galerie
  gallery: {
    create: validate(spiritEmeraudeSchemas.gallery.create),
    update: validate(spiritEmeraudeSchemas.gallery.update)
  },

  // Contact
  contact: {
    create: validate(spiritEmeraudeSchemas.contact.create)
  }
};

module.exports = {
  validateSpiritEmeraude
};
