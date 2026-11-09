const { buildCrudRouter } = require('../../../lib/crud');
const { validatePharmaPilot } = require('../../../validation/middleware');
const { PERMISSIONS } = require('../../../lib/permissions');
const ProductsSchema = require('../model/products.schema');

module.exports = buildCrudRouter({
  modelName: 'Product',
  schema: ProductsSchema,
  entity: 'Produit',
  auditPrefix: 'PRODUCT',
  populate: [
    { path: 'categoryId', select: 'name' },
    { path: 'supplierId', select: 'name' },
  ],
  permissions: {
    read: PERMISSIONS.PRODUCT_VIEW,
    write: PERMISSIONS.PRODUCT_MANAGE,
    remove: PERMISSIONS.PRODUCT_MANAGE,
  },
  createValidation: validatePharmaPilot.products.create,
  updateValidation: validatePharmaPilot.products.update,
  preparePayload: async (req, payload) => {
    if (payload.sku) payload.sku = String(payload.sku).trim().toUpperCase();
    if (payload.barcode === '') payload.barcode = undefined;
    return payload;
  },
});
