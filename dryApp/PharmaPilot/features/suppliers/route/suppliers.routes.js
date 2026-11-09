const { buildCrudRouter } = require('../../../lib/crud');
const { validatePharmaPilot } = require('../../../validation/middleware');
const { PERMISSIONS } = require('../../../lib/permissions');
const SuppliersSchema = require('../model/suppliers.schema');

module.exports = buildCrudRouter({
  modelName: 'Supplier',
  schema: SuppliersSchema,
  entity: 'Fournisseur',
  auditPrefix: 'SUPPLIER',
  permissions: {
    read: PERMISSIONS.SUPPLIER_VIEW,
    write: PERMISSIONS.SUPPLIER_MANAGE,
    remove: PERMISSIONS.SUPPLIER_MANAGE,
  },
  createValidation: validatePharmaPilot.suppliers.create,
  updateValidation: validatePharmaPilot.suppliers.update,
});
