const { validate } = require('../../../dry/utils/validation/validation.util');
const { immoProSchemas } = require('./schemas');

// Mapping des champs significatifs pour generer un label si absent
const labelCandidates = {
  biens: ["label","name","nom","title","titre","subject","email","description","prix","type","surface","chambres","sallesDeBain","adresse","ville","codePostal","disponible"],
  visites: ["label","name","nom","title","titre","subject","email","bienId","clientId","dateVisite","statut","commentaire"],
  clients: ["label","name","nom","title","titre","subject","email","telephone","budget","recherche"],
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

const validateImmoPro = {
  biens: {
    create: validate(immoProSchemas.Bien.create),
    update: validate(immoProSchemas.Bien.update)
  },
  visites: {
    create: validate(immoProSchemas.Visite.create),
    update: validate(immoProSchemas.Visite.update)
  },
  clients: {
    create: validate(immoProSchemas.Client.create),
    update: validate(immoProSchemas.Client.update)
  },
};

module.exports = { validateImmoPro, ensureLabel };
