const { GLOBAL_ROLES } = require('./roles');

/**
 * Permissions granulaires PharmaPilot.
 *
 * Regle non negociable : une permission est TOUJOURS verifiee cote backend
 * (middleware `requirePermission`). Le frontend ne fait que masquer les
 * actions a partir de la meme table, exposee via /auth/profile — il n'est
 * jamais l'autorite.
 *
 * Le modele distingue :
 *  - le role (niveau hierarchique, cf. lib/roles.js) ;
 *  - les permissions effectives, derivees du role + d'eventuelles
 *    autorisations explicites portees par l'utilisateur (`user.permissions`),
 *    ce qui couvre le cas « conserver l'audit : selon autorisation ».
 */
const PERMISSIONS = {
  // Referentiel
  PRODUCT_VIEW: 'product.view',
  PRODUCT_MANAGE: 'product.manage',
  CATEGORY_VIEW: 'category.view',
  CATEGORY_MANAGE: 'category.manage',
  SUPPLIER_VIEW: 'supplier.view',
  SUPPLIER_MANAGE: 'supplier.manage',
  // Stock
  STOCK_VIEW: 'stock.view',
  STOCK_RECONCILE: 'stock.reconcile',
  LOT_VIEW: 'lot.view',
  LOT_MANAGE: 'lot.manage',
  MOVEMENT_VIEW: 'movement.view',
  MOVEMENT_CREATE: 'movement.create',
  RECEIPT_VIEW: 'receipt.view',
  RECEIPT_CREATE: 'receipt.create',
  RECEIPT_VALIDATE: 'receipt.validate',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_CREATE: 'inventory.create',
  INVENTORY_VALIDATE: 'inventory.validate',
  ALERT_VIEW: 'alert.view',
  ALERT_MANAGE: 'alert.manage',
  // Pilotage
  DASHBOARD_VIEW: 'dashboard.view',
  AUDIT_VIEW: 'audit.view',
  // Administration
  USER_MANAGE: 'user.manage',
  PHARMACY_MANAGE: 'pharmacy.manage',
  ORGANIZATION_MANAGE: 'organization.manage',
  SETTINGS_MANAGE: 'settings.manage',
};

const P = PERMISSIONS;

/** Toutes les consultations autorisees des le role preparateur. */
const READ_BASE = [
  P.DASHBOARD_VIEW, P.PRODUCT_VIEW, P.CATEGORY_VIEW, P.SUPPLIER_VIEW,
  P.STOCK_VIEW, P.LOT_VIEW, P.MOVEMENT_VIEW, P.RECEIPT_VIEW,
  P.INVENTORY_VIEW, P.ALERT_VIEW,
];

/** Ecritures du gestionnaire de stock (creation, pas validation). */
const STOCK_MANAGER_WRITES = [
  P.PRODUCT_MANAGE, P.CATEGORY_MANAGE, P.SUPPLIER_MANAGE, P.LOT_MANAGE,
  P.RECEIPT_CREATE, P.MOVEMENT_CREATE, P.INVENTORY_CREATE, P.ALERT_MANAGE,
];

/**
 * Table role -> permissions.
 * Le proprietaire dispose de toutes les permissions non liees a la plateforme.
 */
const ROLE_PERMISSIONS = {
  preparer: [...READ_BASE],
  cashier: [...READ_BASE, P.MOVEMENT_CREATE],
  accountant: [...READ_BASE, P.AUDIT_VIEW],
  stock_manager: [...READ_BASE, ...STOCK_MANAGER_WRITES],
  pharmacist: [
    ...READ_BASE, ...STOCK_MANAGER_WRITES,
    P.RECEIPT_VALIDATE, P.INVENTORY_VALIDATE, P.STOCK_RECONCILE,
    P.AUDIT_VIEW, P.SETTINGS_MANAGE,
  ],
  owner: [
    ...READ_BASE, ...STOCK_MANAGER_WRITES,
    P.RECEIPT_VALIDATE, P.INVENTORY_VALIDATE, P.STOCK_RECONCILE,
    P.AUDIT_VIEW, P.SETTINGS_MANAGE, P.USER_MANAGE,
  ],
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/** Permissions effectives d'un role (+ autorisations explicites). */
const permissionsFor = (role, extras = []) => {
  if (GLOBAL_ROLES.includes(role)) return ALL_PERMISSIONS;
  const base = ROLE_PERMISSIONS[role] || [];
  return Array.from(new Set([...base, ...(extras || [])]));
};

/** Verifie qu'un utilisateur dispose d'une permission donnee. */
const hasPermission = (user, permission) => {
  if (!user) return false;
  if (GLOBAL_ROLES.includes(user.role)) return true;
  return permissionsFor(user.role, user.permissions).includes(permission);
};

/**
 * Middleware factory : exige une permission precise.
 * Complement de `requireRole` (qui raisonne en niveau hierarchique) : ici on
 * raisonne en capacite metier explicite (ex: valider une reception).
 */
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }
  if (!hasPermission(req.user, permission)) {
    return res.status(403).json({
      success: false,
      message: `Permission requise : ${permission}`,
    });
  }
  next();
};

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  permissionsFor,
  hasPermission,
  requirePermission,
};
