const { validate } = require('../../../dry/utils/validation/validation.util');
const { eduProSchemas } = require('./schemas');

// Mapping des champs significatifs pour generer un label si absent
const labelCandidates = {
  etudiants: ["label","name","nom","title","titre","subject","email","prenom","telephone","niveau"],
  cours: ["label","name","nom","title","titre","subject","email","description","niveau","duree","prix"],
  inscriptions: ["label","name","nom","title","titre","subject","email","etudiantId","coursId","dateInscription","statut"],
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

const validateEduPro = {
  etudiants: {
    create: validate(eduProSchemas.Etudiant.create),
    update: validate(eduProSchemas.Etudiant.update)
  },
  cours: {
    create: validate(eduProSchemas.Cours.create),
    update: validate(eduProSchemas.Cours.update)
  },
  inscriptions: {
    create: validate(eduProSchemas.Inscription.create),
    update: validate(eduProSchemas.Inscription.update)
  },
};

module.exports = { validateEduPro, ensureLabel };
