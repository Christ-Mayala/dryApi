const { validate } = require('../../../dry/utils/validation/validation.util');
const { novaSchemas } = require('./schemas');

/**
 * Champs candidats pour generer automatiquement un `label` si absent
 * (le kernel genere ensuite un slug a partir du label).
 */
const labelCandidates = {
  espaces: ['nom', 'titre', 'label'],
  pages: ['titre', 'nom'],
  blocs: ['label'],
  bases: ['titre', 'nom'],
  elements: ['titre', 'nom'],
  commentaires: ['auteurNom', 'label'],
  modeles: ['nom', 'label'],
  connexions: ['nom', 'label'],
  favoris: ['label'],
  notifications: ['titre', 'label'],
  parametres: ['nomEspace', 'label'],
  publications: ['domaine', 'label'],
  ia: ['question', 'label'],
  membres: ['nom', 'email', 'label'],
  versions: ['titre', 'auteurNom', 'label'],
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
  } catch (_) {
    /* jamais bloquant */
  }
  next();
};

const validateNova = {
  espaces: {
    create: validate(novaSchemas.Espaces.create),
    update: validate(novaSchemas.Espaces.update),
  },
  pages: {
    create: validate(novaSchemas.Pages.create),
    update: validate(novaSchemas.Pages.update),
  },
  blocs: {
    create: validate(novaSchemas.Blocs.create),
    update: validate(novaSchemas.Blocs.update),
  },
  bases: {
    create: validate(novaSchemas.Bases.create),
    update: validate(novaSchemas.Bases.update),
  },
  elements: {
    create: validate(novaSchemas.Elements.create),
    update: validate(novaSchemas.Elements.update),
  },
  commentaires: {
    create: validate(novaSchemas.Commentaires.create),
    update: validate(novaSchemas.Commentaires.update),
  },
  modeles: {
    create: validate(novaSchemas.Modeles.create),
    update: validate(novaSchemas.Modeles.update),
  },
  connexions: {
    create: validate(novaSchemas.Connexions.create),
    update: validate(novaSchemas.Connexions.update),
  },
  favoris: {
    create: validate(novaSchemas.Favoris.create),
    update: validate(novaSchemas.Favoris.update),
  },
  notifications: {
    create: validate(novaSchemas.Notifications.create),
    update: validate(novaSchemas.Notifications.update),
  },
  parametres: {
    create: validate(novaSchemas.Parametres.create),
    update: validate(novaSchemas.Parametres.update),
  },
  publications: {
    create: validate(novaSchemas.Publications.create),
    update: validate(novaSchemas.Publications.update),
  },
  ia: {
    create: validate(novaSchemas.Ia.create),
    update: validate(novaSchemas.Ia.update),
  },
  membres: {
    create: validate(novaSchemas.Membres.create),
    update: validate(novaSchemas.Membres.update),
  },
  versions: {
    create: validate(novaSchemas.Versions.create),
    update: validate(novaSchemas.Versions.update),
  },
};

module.exports = { validateNova, ensureLabel };
