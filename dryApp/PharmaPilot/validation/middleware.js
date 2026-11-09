const { validate } = require('../../../dry/utils/validation/validation.util');
const { pharmaPilotSchemas } = require('./schemas');

/**
 * Champs candidats pour generer automatiquement un `label` si absent
 * (le kernel genere ensuite un slug a partir du label).
 */
const labelCandidates = {
  organizations: ['label', 'name', 'nom', 'legalName'],
  pharmacies: ['label', 'name', 'nom', 'title'],
  users: ['label', 'name', 'nom', 'email'],
  categories: ['label', 'name', 'nom', 'title'],
  products: ['label', 'name', 'nom', 'sku'],
  suppliers: ['label', 'name', 'nom', 'title'],
  lots: ['label', 'lotNumber', 'name'],
  receipts: ['label', 'reference', 'name'],
  movements: ['label', 'reason', 'reasonCode'],
  inventories: ['label', 'note', 'scope'],
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
  } catch (_) { /* jamais bloquant */ }
  next();
};

const validatePharmaPilot = {
  organizations: {
    create: validate(pharmaPilotSchemas.Organizations.create),
    update: validate(pharmaPilotSchemas.Organizations.update),
  },
  pharmacies: {
    create: validate(pharmaPilotSchemas.Pharmacies.create),
    update: validate(pharmaPilotSchemas.Pharmacies.update),
  },
  users: {
    create: validate(pharmaPilotSchemas.Users.create),
    update: validate(pharmaPilotSchemas.Users.update),
  },
  categories: {
    create: validate(pharmaPilotSchemas.Categories.create),
    update: validate(pharmaPilotSchemas.Categories.update),
  },
  products: {
    create: validate(pharmaPilotSchemas.Products.create),
    update: validate(pharmaPilotSchemas.Products.update),
  },
  suppliers: {
    create: validate(pharmaPilotSchemas.Suppliers.create),
    update: validate(pharmaPilotSchemas.Suppliers.update),
  },
  lots: {
    create: validate(pharmaPilotSchemas.Lots.create),
    update: validate(pharmaPilotSchemas.Lots.update),
  },
  receipts: {
    create: validate(pharmaPilotSchemas.Receipts.create),
    update: validate(pharmaPilotSchemas.Receipts.update),
  },
  movements: {
    create: validate(pharmaPilotSchemas.Movements.create),
  },
  inventories: {
    create: validate(pharmaPilotSchemas.Inventories.create),
    updateLines: validate(pharmaPilotSchemas.Inventories.updateLines),
  },
  alerts: {
    update: validate(pharmaPilotSchemas.Alerts.update),
  },
};

module.exports = { validatePharmaPilot, ensureLabel };
