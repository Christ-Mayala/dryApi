const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const OrganizationsSchema = require('../model/organizations.schema');
const PharmaciesSchema = require('../../pharmacies/model/pharmacies.schema');
const { notFound } = require('../../../lib/errors');

/**
 * Organisations (tenants) PharmaPilot.
 *
 * Une organisation regroupe une ou plusieurs pharmacies (etablissements).
 * La creation/modification est reservee a l'administration SaaS ; la lecture
 * est cloisonnee : un utilisateur ne voit que les organisations auxquelles
 * ses pharmacies appartiennent.
 */

/** Identifiants d'organisation accessibles a l'utilisateur courant. */
const accessibleOrganizationIds = async (req) => {
  const Pharmacy = req.getModel('Pharmacy', PharmaciesSchema);
  const pharmacies = await Pharmacy.find({ _id: { $in: (req.user.pharmacyIds || []).map(String) } }).select('organizationId');
  return Array.from(new Set(pharmacies.map((p) => String(p.organizationId)).filter(Boolean)));
};

/** LISTE des organisations accessibles. */
exports.getAll = asyncHandler(async (req, res) => {
  const Model = req.getModel('Organization', OrganizationsSchema);
  let filter = {};
  if (!req.isGlobalScope) {
    filter = { _id: { $in: await accessibleOrganizationIds(req) } };
  }
  const list = await Model.find(filter).sort('name');
  return sendResponse(res, list, 'Liste des organisations');
});

/** DETAIL. */
exports.getOne = asyncHandler(async (req, res) => {
  const Model = req.getModel('Organization', OrganizationsSchema);
  let filter = { _id: req.params.id };
  if (!req.isGlobalScope) {
    const allowed = await accessibleOrganizationIds(req);
    if (!allowed.includes(String(req.params.id))) throw notFound('Organisation introuvable');
  }
  const item = await Model.findOne(filter);
  if (!item) throw notFound('Organisation introuvable');
  return sendResponse(res, item, 'Organisation recuperee');
});

/** CREATE — reserve a l'administration SaaS. */
exports.create = asyncHandler(async (req, res) => {
  const Model = req.getModel('Organization', OrganizationsSchema);
  const item = await Model.create({ ...req.body, createdBy: req.user._id, updatedBy: req.user._id });
  return sendResponse(res, item, 'Organisation creee', true, undefined, 201);
});

/** UPDATE. */
exports.update = asyncHandler(async (req, res) => {
  const Model = req.getModel('Organization', OrganizationsSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw notFound('Organisation introuvable');

  const mutable = ['name', 'legalName', 'email', 'phone', 'address', 'billingEmail', 'plan', 'settings', 'label', 'status'];
  mutable.forEach((key) => {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  });
  item.updatedBy = req.user._id;
  await item.save();
  return sendResponse(res, item, 'Organisation mise a jour');
});

/** DELETE — soft delete reserve a l'administration SaaS. */
exports.remove = asyncHandler(async (req, res) => {
  const Model = req.getModel('Organization', OrganizationsSchema);
  const item = await Model.findById(req.params.id);
  if (!item) throw notFound('Organisation introuvable');
  item.status = 'deleted';
  item.updatedBy = req.user._id;
  await item.save();
  return sendResponse(res, null, 'Organisation archivee');
});
