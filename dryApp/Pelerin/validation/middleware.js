const { validate } = require('../../../dry/utils/validation/validation.util');
const { pelerinSchemas } = require('./schemas');

// Mapping des champs significatifs pour generer un label si absent
const labelCandidates = {
  bibleverse: ['label', 'book', 'text'],
  biblebook: ['label', 'nameFr', 'nameEn', 'code'],
};

const ensureLabel = (featureKey) => (req, res, next) => {
  try {
    if (req.body && !req.body.label) {
      const keys = labelCandidates[featureKey] || [];
      for (const key of keys) {
        const val = req.body[key];
        if (typeof val === 'string' && val.trim()) {
          req.body.label = val.trim().slice(0, 200);
          break;
        }
      }
    }
    next();
  } catch (e) {
    next();
  }
};

const validatePelerin = {
  bibleVerse: {
    create: validate(pelerinSchemas.BibleVerse.create),
    update: validate(pelerinSchemas.BibleVerse.update)
  },
  bibleBook: {
    create: validate(pelerinSchemas.BibleBook.create),
    update: validate(pelerinSchemas.BibleBook.update)
  }
};

module.exports = { validatePelerin, ensureLabel };
