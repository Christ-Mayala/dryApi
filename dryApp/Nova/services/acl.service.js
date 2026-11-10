/**
 * Règles d'accès (ACL) partagées de l'espace de travail NOVA.
 *
 * Un administrateur global (`role` admin/superadmin) ou un membre disposant de
 * `novaPermissions.admin` voit l'intégralité du contenu. Les autres comptes sont
 * restreints aux espaces qui leur ont été attribués (`novaEspaceIds`) ; un compte
 * sans `novaEspaceIds` (propriétaire autonome) n'est pas filtré.
 */

const sendResponse = require('../../../dry/utils/http/response');

/** Vrai si l'utilisateur est administrateur de l'espace de travail NOVA. */
function estAdminNova(utilisateur) {
  return (
    utilisateur?.role === 'admin' ||
    utilisateur?.role === 'superadmin' ||
    utilisateur?.novaPermissions?.admin === true
  );
}

/**
 * Vrai si l'utilisateur est un propriétaire autonome : compte connecté sans
 * permissions NOVA explicites (il n'a donc jamais été invité ni restreint).
 */
function estProprietaireNova(utilisateur) {
  return Boolean(utilisateur) && !utilisateur.novaPermissions;
}

/**
 * Vrai si l'utilisateur peut administrer l'espace de travail : administrateur
 * NOVA ou propriétaire autonome. Les membres invités (permissions explicites
 * sans droit admin) sont exclus.
 */
function peutAdministrerNova(utilisateur) {
  return estAdminNova(utilisateur) || estProprietaireNova(utilisateur);
}

/**
 * Middleware Express : n'autorise que le propriétaire NOVA ou un administrateur.
 * @type {import('express').RequestHandler}
 */
function exigerAdministrationNova(req, res, next) {
  if (peutAdministrerNova(req.user)) return next();
  return sendResponse(res, null, 'Action réservée aux administrateurs', false, undefined, 403);
}

/**
 * Vrai si l'utilisateur peut partager une page (publication web, invitations) :
 * propriétaire/administrateur, ou membre auquel le droit `partage` a été accordé.
 */
function peutPartagerNova(utilisateur) {
  if (peutAdministrerNova(utilisateur)) return true;
  return utilisateur?.novaPermissions?.partage === true;
}

/**
 * Middleware Express : n'autorise que les comptes disposant du droit de partage.
 * @type {import('express').RequestHandler}
 */
function exigerPartageNova(req, res, next) {
  if (peutPartagerNova(req.user)) return next();
  return sendResponse(res, null, 'Partage non autorisé pour votre rôle', false, undefined, 403);
}

/**
 * Identifiants d'espaces visibles pour l'utilisateur.
 * - `null` : aucun filtrage (administrateur ou compte autonome sans restriction).
 * - Tableau (éventuellement vide) : accès limité à ces espaces.
 *
 * @param {Object} utilisateur - Document User (contient `novaEspaceIds`).
 * @returns {string[]|null}
 */
function idsEspacesAutorises(utilisateur) {
  if (!utilisateur || estAdminNova(utilisateur)) return null;
  const ids = utilisateur.novaEspaceIds;
  if (!Array.isArray(ids)) return null;
  return ids.map((id) => String(id));
}

/**
 * Impose des critères de filtre supplémentaires sur `req.query`.
 * `req.query` est un accesseur en lecture seule (Express 5) : une simple
 * affectation est silencieusement ignorée. On définit donc une propriété propre
 * sur la requête, consommée ensuite par le queryBuilder du noyau DRY.
 *
 * @param {import('express').Request} req
 * @param {Object} filtre - Critères Mongo à fusionner (prioritaires).
 */
function forcerFiltre(req, filtre) {
  Object.defineProperty(req, 'query', {
    value: { ...req.query, ...filtre },
    writable: true,
    configurable: true,
  });
}

module.exports = {
  estAdminNova,
  estProprietaireNova,
  peutAdministrerNova,
  exigerAdministrationNova,
  peutPartagerNova,
  exigerPartageNova,
  idsEspacesAutorises,
  forcerFiltre,
};


