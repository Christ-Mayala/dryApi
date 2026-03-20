const { validate } = require('../../../dry/utils/validation/validation.util');
const { belelaSchemas } = require('./schemas');

// Mapping des champs significatifs pour generer un label si absent
const labelCandidates = {
  post: ["label","name","nom","title","titre","subject","email","description"],
  annonce: ["label","name","nom","title","titre","subject","email","description"],
};

const ensureLabel = (featureKey) => (req, res, next) => {
  try {
    if (req.body && !req.body.label) {
      const keys = labelCandidates[featureKey] || [];
      for (const key of keys) {
        const val = req.body[key];
        if (typeof val === 'string' && val.trim()) {
          req.body.label = val.trim();
          break;
        }
      }
    }
    next();
  } catch (e) {
    next();
  }
};

const validateBelela = {
  post: {
    create: validate(belelaSchemas.Post.create),
    update: validate(belelaSchemas.Post.update)
  },
  annonce: {
    create: validate(belelaSchemas.Annonce.create),
    update: validate(belelaSchemas.Annonce.update)
  },
};

module.exports = { validateBelela, ensureLabel };
