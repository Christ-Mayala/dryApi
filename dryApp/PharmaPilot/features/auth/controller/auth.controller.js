const asyncHandler = require('express-async-handler');
const kernelAuth = require('../../../../../dry/modules/user/auth.controller');
const sendResponse = require('../../../../../dry/utils/http/response');
const { ROLE_LABELS, ROLE_HIERARCHY } = require('../../../lib/roles');
const { permissionsFor } = require('../../../lib/permissions');
const PharmaciesSchema = require('../../pharmacies/model/pharmacies.schema');

/**
 * Authentification PharmaPilot.
 * On reutilise integralement les controleurs du kernel DRY (JWT acces +
 * refresh rotatif hache, verrouillage, changement de mot de passe) : aucune
 * logique d'auth n'est dupliquee, seule la surface d'exposition change.
 */
exports.login = kernelAuth.login;
exports.refresh = kernelAuth.refresh;
exports.logout = kernelAuth.logout;
exports.updateMe = kernelAuth.updateMe;
exports.changePassword = kernelAuth.changePassword;

/**
 * Profil enrichi : role, libelle, niveau hierarchique, permissions effectives,
 * organisation (tenant), pharmacie active et pharmacies accessibles.
 *
 * Les `permissions` exposees ici ne servent qu'a l'affichage cote client : la
 * decision d'autorisation reste integralement prise par le backend
 * (`requirePermission`). Elles evitent toutefois d'afficher une action qui
 * serait systematiquement refusee.
 */
exports.profile = asyncHandler(async (req, res) => {
  const Pharmacy = req.getModel('Pharmacy', PharmaciesSchema);

  const pharmacies = req.isGlobalScope
    ? await Pharmacy.find().select('name address phone status organizationId').sort('name')
    : await Pharmacy.find({ _id: { $in: req.user.pharmacyIds || [] } })
        .select('name address phone status organizationId')
        .sort('name');

  return sendResponse(
    res,
    {
      user: req.user,
      role: req.user.role,
      roleLabel: ROLE_LABELS[req.user.role] || req.user.role,
      level: ROLE_HIERARCHY[req.user.role] || 0,
      permissions: permissionsFor(req.user.role, req.user.permissions),
      // Organisation cliente (tenant).
      tenantId: req.tenantId || null,
      organizationId: req.tenantId || null,
      // Etablissement courant (cloisonnement des donnees metier).
      pharmacyId: req.pharmacyId || null,
      isGlobalScope: !!req.isGlobalScope,
      pharmacies,
    },
    'Profil PharmaPilot'
  );
});
