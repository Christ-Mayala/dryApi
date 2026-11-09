const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { withAudit } = require('../../../../../dry/middlewares/audit');
const { invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');
const PharmaciesSchema = require('../model/pharmacies.schema');
const OrganizationsSchema = require('../../organizations/model/organizations.schema');
const { tenantFilter } = require('../../../lib/tenant');
const { notFound, forbidden } = require('../../../lib/errors');

const scopeFilter = (req, extra = {}) =>
  req.isGlobalScope
    ? { ...extra }
    : { ...extra, _id: { $in: (req.user.pharmacyIds || []).map(String) } };

/** LISTE — pharmacies accessibles a l'utilisateur. */
exports.getAll = asyncHandler(async (req, res) => {
  const Model = req.getModel('Pharmacy', PharmaciesSchema);
  const list = await Model.find(scopeFilter(req)).sort('name');
  return sendResponse(res, list, 'Liste des pharmacies');
});

/** DETAIL. */
exports.getOne = asyncHandler(async (req, res) => {
  const Model = req.getModel('Pharmacy', PharmaciesSchema);
  const item = await Model.findOne({ _id: req.params.id, ...scopeFilter(req) });
  if (!item) throw notFound('Pharmacie introuvable');
  return sendResponse(res, item, 'Pharmacie recuperee');
});

/**
 * CREATE — reserve a l'administration SaaS.
 *
 * Une pharmacie appartient toujours a une organisation (tenant). Si
 * `organizationId` n'est pas fourni, une organisation portant le nom de la
 * pharmacie est creee : la creation d'une officine reste ainsi immediate tout
 * en conservant la possibilite de rattacher plusieurs pharmacies a une meme
 * organisation (supervision depuis un compte unique, stocks separes).
 */
exports.create = asyncHandler(async (req, res) => {
  const Model = req.getModel('Pharmacy', PharmaciesSchema);
  const Organization = req.getModel('Organization', OrganizationsSchema);

  const { organizationId: providedOrgId, ...body } = req.body;

  let organizationId = providedOrgId || null;
  if (organizationId) {
    const org = await Organization.findById(organizationId);
    if (!org) throw notFound('Organisation introuvable');
  } else {
    const org = await Organization.create({
      name: body.name,
      legalName: body.name,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      billingEmail: body.email || null,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    organizationId = org._id;
  }

  const item = await Model.create({
    ...body,
    organizationId,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  return sendResponse(res, item, 'Pharmacie creee', true, undefined, 201);
});

/** UPDATE — proprietaire de la pharmacie ou administration SaaS. */
exports.update = asyncHandler(async (req, res) => {
  const Model = req.getModel('Pharmacy', PharmaciesSchema);
  const item = await Model.findOne({ _id: req.params.id, ...scopeFilter(req) });
  if (!item) throw notFound('Pharmacie introuvable');

  const mutable = ['name', 'address', 'phone', 'email', 'licenseNumber', 'settings', 'label', 'status', 'organizationId'];
  mutable.forEach((key) => {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  });
  item.updatedBy = req.user._id;
  await item.save();
  return sendResponse(res, item, 'Pharmacie mise a jour');
});

/** DELETE — soft delete reserve a l'administration SaaS. */
exports.remove = asyncHandler(async (req, res) => {
  const Model = req.getModel('Pharmacy', PharmaciesSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw notFound('Pharmacie introuvable');
  item.status = 'deleted';
  item.updatedBy = req.user._id;
  await item.save();
  return sendResponse(res, null, 'Pharmacie archivee');
});

exports.middlewares = { invalidateCache, withAudit, tenantFilter, forbidden };
