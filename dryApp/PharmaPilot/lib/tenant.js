const { GLOBAL_ROLES, hasRoleLevel } = require('./roles');
const PharmaciesSchema = require('../features/pharmacies/model/pharmacies.schema');

/**
 * Resolution du contexte de requete (organisation + etablissement).
 *
 * Deux notions distinctes, jamais confondues :
 *  - `req.tenantId`   : l'ORGANISATION cliente qui paie l'abonnement ;
 *  - `req.pharmacyId` : l'ETABLISSEMENT (pharmacie) dans lequel on travaille.
 *
 * Les donnees metier (stocks, produits, receptions...) sont cloisonnees par
 * `pharmacyId` ; `tenantId` sert a rattacher chaque document a son
 * organisation proprietaire.
 *
 * Regle de securite non negociable : l'identifiant de pharmacie n'est JAMAIS
 * lu depuis le body ou la query libre. Il est deduit de la session, puis
 * eventuellement cible via l'en-tete `X-Pharmacy-Id` — mais uniquement si
 * l'utilisateur est membre de cette pharmacie (ou dispose d'une portee globale).
 */
const resolveTenant = async (req, res, next) => {
  try {
    if (!req.user) return next();

    const memberships = (req.user.pharmacyIds || []).map(String);
    const isGlobal = GLOBAL_ROLES.includes(req.user.role);
    const headerId = req.headers['x-pharmacy-id'] ? String(req.headers['x-pharmacy-id']) : null;
    const activeId = req.user.activePharmacyId ? String(req.user.activePharmacyId) : null;

    const allowed = (id) => id && (isGlobal || memberships.includes(id));

    let pharmacyId = null;
    if (allowed(headerId)) pharmacyId = headerId;
    else if (allowed(activeId)) pharmacyId = activeId;
    else if (memberships.length) pharmacyId = memberships[0];

    req.pharmacyId = pharmacyId;
    req.tenantId = null;
    req.isGlobalScope = isGlobal;

    // `tenantId` (organisation) est derive de la pharmacie active : il n'est
    // jamais fourni par le client, ce qui garantit qu'on ne peut pas ecrire
    // dans une organisation a laquelle on n'appartient pas.
    if (pharmacyId && typeof req.getModel === 'function') {
      const Pharmacy = req.getModel('Pharmacy', PharmaciesSchema);
      const pharmacy = await Pharmacy.findOne({ _id: pharmacyId, status: { $ne: 'deleted' } }).select('organizationId');
      if (pharmacy?.organizationId) req.tenantId = String(pharmacy.organizationId);
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Filtre Mongo a appliquer sur toute collection metier pour garantir
 * le cloisonnement des pharmacies (jamais par organisation : deux
 * etablissements d'une meme organisation gardent des stocks separes).
 */
const tenantFilter = (req, extra = {}) => {
  const filter = { ...extra };
  if (req.pharmacyId) {
    filter.pharmacyId = req.pharmacyId;
  } else if (!req.isGlobalScope) {
    // Utilisateur non global sans pharmacie active : ne voit rien.
    filter.pharmacyId = { $in: (req.user?.pharmacyIds || []).map(String) };
  }
  // Portee globale sans pharmacie active : vue plateforme (pas de filtre).
  return filter;
};

/**
 * Injecte le filtre pharmacie dans req.query AVANT le queryBuilder du kernel,
 * afin que la pagination/recherche/filtrage restent mutuellement cloisonnes.
 * queryBuilder convertit automatiquement les valeurs separees par des virgules
 * en operateur $in (exploite pour le cas multi-pharmacies).
 */
const applyTenantQuery = (req, res, next) => {
  if (!req.query) req.query = {};
  if (req.pharmacyId) {
    req.query.pharmacyId = String(req.pharmacyId);
  } else if (!req.isGlobalScope) {
    const ids = (req.user?.pharmacyIds || []).map(String);
    if (ids.length) req.query.pharmacyId = ids.join(',');
  }
  // Portee globale sans pharmacie active : pas de filtre (vue plateforme).
  next();
};

/**
 * Middleware factory : exige un niveau de role minimum.
 * Completer `protect` et `authorize` du kernel (qui compare par egalite stricte).
 */
const requireRole = (minRole) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }
  if (!hasRoleLevel(req.user.role, minRole)) {
    return res.status(403).json({
      success: false,
      message: `Droits insuffisants : role '${minRole}' minimum requis`,
    });
  }
  next();
};

module.exports = { resolveTenant, tenantFilter, applyTenantQuery, requireRole };
