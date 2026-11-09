const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const PharmaciesSchema = require('../../pharmacies/model/pharmacies.schema');
const PharmaPilotUserSchema = require('../../auth/model/pharmaPilotUser.schema');
const { notFound, conflict, badRequest } = require('../../../lib/errors');

/** Filtre de portee : un utilisateur non global ne voit que les comptes de ses pharmacies. */
const scopeFilter = (req, extra = {}) =>
  req.isGlobalScope
    ? { ...extra }
    : { ...extra, pharmacyIds: { $in: (req.user.pharmacyIds || []).map(String) } };

/** LISTE paginee des utilisateurs de la/des pharmacie(s). */
exports.getAll = asyncHandler(async (req, res) => {
  const { data, pagination } = res.advancedResults || { data: [], pagination: null };
  return sendResponse(res, data, 'Liste des utilisateurs', true, pagination || undefined);
});

/** DETAIL. */
exports.getOne = asyncHandler(async (req, res) => {
  const User = req.getModel('User', PharmaPilotUserSchema);
  const item = await User.findOne(scopeFilter(req, { _id: req.params.id }));
  if (!item) throw notFound('Utilisateur introuvable');
  return sendResponse(res, item, 'Utilisateur recupere');
});

/** CREATE — un compte est toujours rattache a au moins une pharmacie. */
exports.create = asyncHandler(async (req, res) => {
  const User = req.getModel('User', PharmaPilotUserSchema);
  const Pharmacy = req.getModel('Pharmacy', PharmaciesSchema);

  const payload = { ...req.body };
  const email = String(payload.email || '').toLowerCase().trim();
  const exists = await User.findOne({ email, includeDeleted: true });
  if (exists) throw conflict('Cet email est deja utilise');

  let pharmacyIds = (payload.pharmacyIds || []).map(String);
  if (!pharmacyIds.length && req.pharmacyId) pharmacyIds = [String(req.pharmacyId)];
  if (!pharmacyIds.length) throw badRequest('Au moins une pharmacie est requise');

  // Un utilisateur non global ne peut rattacher un compte qu'a ses propres pharmacies.
  if (!req.isGlobalScope) {
    const allowed = new Set((req.user.pharmacyIds || []).map(String));
    if (pharmacyIds.some((id) => !allowed.has(id))) {
      throw badRequest("Vous ne pouvez rattacher un utilisateur qu'a vos pharmacies");
    }
  }

  const pharmacies = await Pharmacy.find({ _id: { $in: pharmacyIds } }).select('organizationId');
  if (pharmacies.length !== pharmacyIds.length) throw badRequest('Pharmacie inexistante');

  payload.pharmacyIds = pharmacyIds;
  payload.activePharmacyId = payload.activePharmacyId || pharmacyIds[0];
  // Rattachement a l'organisation (tenant) : il est derive des pharmacies
  // ciblees — et non de la pharmacie active de l'operateur — afin qu'un
  // administrateur SaaS puisse provisionner un compte pour une pharmacie
  // qu'il ne gere pas lui-meme (dont l'organisation differe de la sienne).
  const organizationId = pharmacies.find((p) => p.organizationId)?.organizationId;
  if (organizationId) payload.organizationId = organizationId;
  payload.createdBy = req.user._id;
  payload.updatedBy = req.user._id;

  const item = await User.create(payload);
  const safe = item.toObject();
  return sendResponse(res, safe, 'Utilisateur cree', true, undefined, 201);
});

/** UPDATE. */
exports.update = asyncHandler(async (req, res) => {
  const User = req.getModel('User', PharmaPilotUserSchema);
  const item = await User.findOne(scopeFilter(req, { _id: req.params.id }));
  if (!item) throw notFound('Utilisateur introuvable');

  const fields = ['name', 'email', 'phone', 'role', 'matricule', 'poste', 'status', 'activePharmacyId', 'permissions'];
  fields.forEach((key) => {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  });
  if (req.body.pharmacyIds !== undefined) {
    let pharmacyIds = req.body.pharmacyIds.map(String);
    if (!req.isGlobalScope) {
      const allowed = new Set((req.user.pharmacyIds || []).map(String));
      if (pharmacyIds.some((id) => !allowed.has(id))) {
        throw badRequest("Vous ne pouvez rattacher un utilisateur qu'a vos pharmacies");
      }
    }
    item.pharmacyIds = pharmacyIds;
  }
  if (req.body.password) item.password = req.body.password;
  item.updatedBy = req.user._id;

  await item.save();
  const safe = item.toObject();
  return sendResponse(res, safe, 'Utilisateur mis a jour');
});

/** DELETE — soft delete (jamais de suppression physique d'un compte). */
exports.remove = asyncHandler(async (req, res) => {
  const User = req.getModel('User', PharmaPilotUserSchema);
  const item = await User.findOne(scopeFilter(req, { _id: req.params.id }));
  if (!item) throw notFound('Utilisateur introuvable');
  if (String(item._id) === String(req.user._id)) throw badRequest('Impossible de supprimer son propre compte');
  await item.softDelete();
  return sendResponse(res, null, 'Utilisateur desactive');
});
