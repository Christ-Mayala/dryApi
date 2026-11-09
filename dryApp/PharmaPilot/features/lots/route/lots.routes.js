const { buildCrudRouter } = require('../../../lib/crud');
const { validatePharmaPilot } = require('../../../validation/middleware');
const { PERMISSIONS } = require('../../../lib/permissions');
const LotsSchema = require('../model/lots.schema');

/**
 * Lots et peremptions.
 * La quantite recue est mise a jour par le flux de reception ; une modification
 * manuelle reste possible mais tracee (audit).
 */
module.exports = buildCrudRouter({
  modelName: 'Lot',
  schema: LotsSchema,
  entity: 'Lot',
  auditPrefix: 'LOT',
  populate: [
    { path: 'productId', select: 'name sku unit form' },
    { path: 'supplierId', select: 'name' },
  ],
  permissions: {
    read: PERMISSIONS.LOT_VIEW,
    write: PERMISSIONS.LOT_MANAGE,
    remove: PERMISSIONS.LOT_MANAGE,
  },
  createValidation: validatePharmaPilot.lots.create,
  updateValidation: validatePharmaPilot.lots.update,
});
