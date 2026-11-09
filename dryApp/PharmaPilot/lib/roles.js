/**
 * Roles metier PharmaPilot et leur niveau hierarchique.
 *
 * Convention DRY : les roles applicatifs sont definis cote application
 * (dryApp/PharmaPilot/), jamais dans le kernel (dry/). Le kernel expose un
 * enum generique que l'on etend ici via un schema User specifique.
 */

const ROLES = {
  OWNER: 'owner',                 // Proprietaire / titulaire
  PHARMACIST: 'pharmacist',       // Pharmacien responsable
  STOCK_MANAGER: 'stock_manager', // Gestionnaire de stock
  PREPARER: 'preparer',           // Preparateur
  CASHIER: 'cashier',             // Caissier
  ACCOUNTANT: 'accountant',       // Comptable
  SAAS_ADMIN: 'saas_admin',       // Administrateur SaaS (plateforme)
  // Roles techniques DRY (compatibilite seeder global / admin plateforme)
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
};

// Hierarchie : plus le niveau est eleve, plus les droits sont larges.
// Sert au controle d'acces (>= role requis) cote backend et frontend.
const ROLE_HIERARCHY = {
  superadmin: 100,
  saas_admin: 90,
  admin: 80,
  owner: 70,
  pharmacist: 60,
  stock_manager: 40,
  accountant: 30,
  cashier: 25,
  preparer: 20,
};

const ROLE_LABELS = {
  owner: 'Proprietaire / Titulaire',
  pharmacist: 'Pharmacien responsable',
  stock_manager: 'Gestionnaire de stock',
  preparer: 'Preparateur',
  cashier: 'Caissier',
  accountant: 'Comptable',
  saas_admin: 'Administrateur SaaS',
  admin: 'Administrateur',
  superadmin: 'Super administrateur',
};

// Tous les roles acceptes par le schema User PharmaPilot.
// On conserve les roles DRY generiques pour rester compatible avec le seeder global.
const ALL_ROLES = Object.keys(ROLE_HIERARCHY);

// Roles disposant d'une portee globale (toutes les pharmacies).
const GLOBAL_ROLES = ['superadmin', 'saas_admin', 'admin'];

/** Verifie qu'un role satisfait un niveau minimum requis. */
const hasRoleLevel = (userRole, requiredRole) => {
  const current = ROLE_HIERARCHY[userRole] ?? 0;
  const required = ROLE_HIERARCHY[requiredRole] ?? 0;
  return current >= required;
};

module.exports = { ROLES, ROLE_HIERARCHY, ROLE_LABELS, ALL_ROLES, GLOBAL_ROLES, hasRoleLevel };
