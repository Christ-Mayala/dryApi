const { validate } = require('../../../dry/utils/validation/validation.util');
const { zertySchemas } = require('./schemas');

// Mapping des champs significatifs pour generer un label si absent
const labelCandidates = {
  severgold: ["label","name","nom","title","titre","subject","email","Mays"],
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

const validatezerty = {
  severgold: {
    create: validate(zertySchemas.Severgold.create),
    update: validate(zertySchemas.Severgold.update)
  },
};

module.exports = { validatezerty, ensureLabel };
