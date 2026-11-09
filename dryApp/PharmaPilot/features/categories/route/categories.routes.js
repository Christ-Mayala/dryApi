const { buildCrudRouter } = require('../../../lib/crud');
const { validatePharmaPilot } = require('../../../validation/middleware');
const { PERMISSIONS } = require('../../../lib/permissions');
const CategoriesSchema = require('../model/categories.schema');

module.exports = buildCrudRouter({
  modelName: 'Category',
  schema: CategoriesSchema,
  entity: 'Categorie',
  auditPrefix: 'CATEGORY',
  populate: [{ path: 'parentId', select: 'name' }],
  permissions: {
    read: PERMISSIONS.CATEGORY_VIEW,
    write: PERMISSIONS.CATEGORY_MANAGE,
    remove: PERMISSIONS.CATEGORY_MANAGE,
  },
  createValidation: validatePharmaPilot.categories.create,
  updateValidation: validatePharmaPilot.categories.update,
});
