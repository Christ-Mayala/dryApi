const Joi = require('joi');
const { commonSchemas } = require('../../../dry/utils/validation/validation.util');
const { ALL_PERMISSIONS } = require('../lib/permissions');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
  'string.pattern.base': 'Identifiant invalide',
});

const PHARMA_ROLES = ['owner', 'pharmacist', 'stock_manager', 'preparer', 'cashier', 'accountant', 'saas_admin', 'admin', 'superadmin'];

const MOVEMENT_REASON_CODES = [
  'receipt', 'sale', 'loss', 'breakage', 'donation',
  'return_supplier', 'return_customer', 'correction', 'inventory', 'expiry', 'transfer',
];

/**
 * Schemas Joi PharmaPilot — valident les entrees HTTP avant tout traitement
 * metier (convention DRY : validation/schemas.js + validation/middleware.js).
 */
const pharmaPilotSchemas = {
  Organizations: {
    create: Joi.object({
      name: Joi.string().min(2).max(150).required(),
      legalName: Joi.string().max(150).allow('', null).optional(),
      email: Joi.string().email().allow('', null).optional(),
      phone: Joi.string().max(30).allow('', null).optional(),
      address: Joi.string().max(300).allow('', null).optional(),
      billingEmail: Joi.string().email().allow('', null).optional(),
      plan: Joi.string().max(40).optional(),
      settings: Joi.object({
        currency: Joi.string().max(10).default('XAF'),
      }).optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional(),
    }),
    update: Joi.object({
      name: Joi.string().min(2).max(150).optional(),
      legalName: Joi.string().max(150).allow('', null).optional(),
      email: Joi.string().email().allow('', null).optional(),
      phone: Joi.string().max(30).allow('', null).optional(),
      address: Joi.string().max(300).allow('', null).optional(),
      billingEmail: Joi.string().email().allow('', null).optional(),
      plan: Joi.string().max(40).optional(),
      settings: Joi.object({
        currency: Joi.string().max(10).optional(),
      }).optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional(),
    }),
  },

  Pharmacies: {
    create: Joi.object({
      name: Joi.string().min(2).max(150).required(),
      // Organisation proprietaire (tenantId). Optionnelle : par defaut une
      // nouvelle organisation portant le nom de la pharmacie est creee.
      organizationId: objectId.allow(null).optional(),
      address: Joi.string().max(300).allow('', null).optional(),
      phone: Joi.string().max(30).allow('', null).optional(),
      email: Joi.string().email().allow('', null).optional(),
      licenseNumber: Joi.string().max(60).allow('', null).optional(),
      settings: Joi.object({
        currency: Joi.string().max(10).default('XAF'),
        lowStockThreshold: Joi.number().integer().min(0).default(10),
        expiryAlertDays: Joi.number().integer().min(1).default(90),
      }).optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional(),
    }),
    update: Joi.object({
      name: Joi.string().min(2).max(150).optional(),
      organizationId: objectId.allow(null).optional(),
      address: Joi.string().max(300).allow('', null).optional(),
      phone: Joi.string().max(30).allow('', null).optional(),
      email: Joi.string().email().allow('', null).optional(),
      licenseNumber: Joi.string().max(60).allow('', null).optional(),
      settings: Joi.object({
        currency: Joi.string().max(10).optional(),
        lowStockThreshold: Joi.number().integer().min(0).optional(),
        expiryAlertDays: Joi.number().integer().min(1).optional(),
      }).optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional(),
    }),
  },

  Users: {
    create: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      email: commonSchemas.email.required(),
      password: Joi.string().min(8).required(),
      role: Joi.string().valid(...PHARMA_ROLES).default('preparer'),
      phone: Joi.string().max(30).allow('', null).optional(),
      matricule: Joi.string().max(40).allow('', null).optional(),
      poste: Joi.string().max(80).allow('', null).optional(),
      pharmacyIds: Joi.array().items(objectId).optional(),
      activePharmacyId: objectId.optional(),
      permissions: Joi.array().items(Joi.string().valid(...ALL_PERMISSIONS)).optional(),
      status: commonSchemas.status.optional(),
    }),
    update: Joi.object({
      name: Joi.string().min(2).max(100).optional(),
      email: commonSchemas.email.optional(),
      password: Joi.string().min(8).optional(),
      role: Joi.string().valid(...PHARMA_ROLES).optional(),
      phone: Joi.string().max(30).allow('', null).optional(),
      matricule: Joi.string().max(40).allow('', null).optional(),
      poste: Joi.string().max(80).allow('', null).optional(),
      pharmacyIds: Joi.array().items(objectId).optional(),
      activePharmacyId: objectId.allow(null).optional(),
      permissions: Joi.array().items(Joi.string().valid(...ALL_PERMISSIONS)).optional(),
      status: commonSchemas.status.optional(),
    }),
  },

  Categories: {
    create: Joi.object({
      name: Joi.string().min(2).max(120).required(),
      description: Joi.string().max(500).allow('', null).optional(),
      parentId: objectId.allow(null).optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional(),
    }),
    update: Joi.object({
      name: Joi.string().min(2).max(120).optional(),
      description: Joi.string().max(500).allow('', null).optional(),
      parentId: objectId.allow(null).optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional(),
    }),
  },

  Products: {
    create: Joi.object({
      sku: Joi.string().max(60).required(),
      name: Joi.string().min(2).max(180).required(),
      categoryId: objectId.allow(null).optional(),
      supplierId: objectId.allow(null).optional(),
      form: Joi.string().valid('comprime', 'sirop', 'gelule', 'injectable', 'pommade', 'collyre', 'autre').default('comprime'),
      unit: Joi.string().max(30).default('boite'),
      unitConversion: Joi.object({
        baseUnit: Joi.string().max(30),
        factor: Joi.number().positive(),
      }).optional(),
      dosage: Joi.string().max(80).allow('', null).optional(),
      barcode: Joi.string().max(60).allow('', null).optional(),
      price: Joi.number().min(0).allow(null).optional(),
      reorderThreshold: Joi.number().integer().min(0).default(10),
      minStock: Joi.number().integer().min(0).default(0),
      prescriptionRequired: Joi.boolean().default(false),
      description: Joi.string().max(1000).allow('', null).optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional(),
    }),
    update: Joi.object({
      sku: Joi.string().max(60).optional(),
      name: Joi.string().min(2).max(180).optional(),
      categoryId: objectId.allow(null).optional(),
      supplierId: objectId.allow(null).optional(),
      form: Joi.string().valid('comprime', 'sirop', 'gelule', 'injectable', 'pommade', 'collyre', 'autre').optional(),
      unit: Joi.string().max(30).optional(),
      unitConversion: Joi.object({
        baseUnit: Joi.string().max(30),
        factor: Joi.number().positive(),
      }).optional(),
      dosage: Joi.string().max(80).allow('', null).optional(),
      barcode: Joi.string().max(60).allow('', null).optional(),
      price: Joi.number().min(0).allow(null).optional(),
      reorderThreshold: Joi.number().integer().min(0).optional(),
      minStock: Joi.number().integer().min(0).optional(),
      prescriptionRequired: Joi.boolean().optional(),
      description: Joi.string().max(1000).allow('', null).optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional(),
    }),
  },

  Suppliers: {
    create: Joi.object({
      name: Joi.string().min(2).max(150).required(),
      contactName: Joi.string().max(120).allow('', null).optional(),
      phone: Joi.string().max(30).allow('', null).optional(),
      email: Joi.string().email().allow('', null).optional(),
      address: Joi.string().max(300).allow('', null).optional(),
      licenseNumber: Joi.string().max(60).allow('', null).optional(),
      notes: Joi.string().max(500).allow('', null).optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional(),
    }),
    update: Joi.object({
      name: Joi.string().min(2).max(150).optional(),
      contactName: Joi.string().max(120).allow('', null).optional(),
      phone: Joi.string().max(30).allow('', null).optional(),
      email: Joi.string().email().allow('', null).optional(),
      address: Joi.string().max(300).allow('', null).optional(),
      licenseNumber: Joi.string().max(60).allow('', null).optional(),
      notes: Joi.string().max(500).allow('', null).optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional(),
    }),
  },

  Lots: {
    create: Joi.object({
      productId: objectId.required(),
      lotNumber: Joi.string().min(1).max(80).required(),
      expiryDate: Joi.date().iso().required(),
      receivedAt: Joi.date().iso().optional(),
      quantityReceived: Joi.number().min(0).default(0),
      supplierId: objectId.allow(null).optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional(),
    }),
    update: Joi.object({
      lotNumber: Joi.string().min(1).max(80).optional(),
      expiryDate: Joi.date().iso().optional(),
      receivedAt: Joi.date().iso().optional(),
      supplierId: objectId.allow(null).optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional(),
    }),
  },

  Receipts: {
    create: Joi.object({
      supplierId: objectId.required(),
      reference: Joi.string().max(80).allow('', null).optional(),
      receivedAt: Joi.date().iso().optional(),
      note: Joi.string().max(500).allow('', null).optional(),
      lines: Joi.array().items(Joi.object({
        productId: objectId.required(),
        lotNumber: Joi.string().max(80).required(),
        expiryDate: Joi.date().iso().required(),
        quantityReceived: Joi.number().integer().min(1).required(),
        quantityRejected: Joi.number().integer().min(0).default(0),
        unitCost: Joi.number().min(0).allow(null).optional(),
      })).min(1).required(),
    }),
    update: Joi.object({
      supplierId: objectId.optional(),
      reference: Joi.string().max(80).allow('', null).optional(),
      receivedAt: Joi.date().iso().optional(),
      note: Joi.string().max(500).allow('', null).optional(),
      lines: Joi.array().items(Joi.object({
        productId: objectId.required(),
        lotNumber: Joi.string().max(80).required(),
        expiryDate: Joi.date().iso().required(),
        quantityReceived: Joi.number().integer().min(1).required(),
        quantityRejected: Joi.number().integer().min(0).default(0),
        unitCost: Joi.number().min(0).allow(null).optional(),
      })).min(1).optional(),
    }),
  },

  Movements: {
    create: Joi.object({
      productId: objectId.required(),
      lotId: objectId.allow(null).optional(),
      type: Joi.string().valid('out', 'adjustment').default('out'),
      quantity: Joi.number().min(1).required(),
      sign: Joi.number().valid(1, -1).default(-1),
      reasonCode: Joi.string().valid(...MOVEMENT_REASON_CODES).required(),
      reason: Joi.string().max(300).allow('', null).optional(),
      note: Joi.string().max(500).allow('', null).optional(),
      occurredAt: Joi.date().iso().optional(),
    }),
  },

  Inventories: {
    create: Joi.object({
      scope: Joi.string().valid('full', 'partial').default('full'),
      categoryId: objectId.allow(null).optional(),
      note: Joi.string().max(500).allow('', null).optional(),
    }),
    updateLines: Joi.object({
      lines: Joi.array().items(Joi.object({
        productId: objectId.required(),
        lotId: objectId.allow(null).optional(),
        countedQuantity: Joi.number().min(0).required(),
        justification: Joi.string().max(300).allow('', null).optional(),
      })).min(1).required(),
    }),
  },

  Alerts: {
    update: Joi.object({
      status: Joi.string().valid('open', 'acknowledged', 'resolved', 'ignored').optional(),
      note: Joi.string().max(500).allow('', null).optional(),
    }),
  },
};

module.exports = { pharmaPilotSchemas, PHARMA_ROLES, MOVEMENT_REASON_CODES };
