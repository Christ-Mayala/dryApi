/**
 * DryRoleGuard — Contrôle d'accès basé sur les rôles
 *
 * Fonctions utilitaires :
 *   hasAccess(requiredRole, userRole)  => boolean
 *   canAccess(feature, userRole)       => boolean
 *   getAccessibleFeatures(features, userRole) => [{ name, label }]
 *
 * Composant :
 *   <DryRoleGuard role="admin" userRole={userRole} fallback={<p>Accès refusé</p>}>
 *     <AdminPanel />
 *   </DryRoleGuard>
 */

// Hiérarchie des rôles : admin > manager > client > user
const ROLE_HIERARCHY = {
  superadmin: 100,
  admin: 80,
  manager: 60,
  client: 40,
  user: 20,
  guest: 0,
};

/**
 * Vérifie si un utilisateur a le niveau d'accès requis
 * @param {string} requiredRole - Rôle minimum requis
 * @param {string} [userRole='guest'] - Rôle de l'utilisateur courant
 * @returns {boolean} true si l'utilisateur a accès
 */
export function hasAccess(requiredRole, userRole = 'guest') {
  const required = ROLE_HIERARCHY[requiredRole] ?? 0;
  const current = ROLE_HIERARCHY[userRole] ?? 0;
  return current >= required;
}

/**
 * Vérifie si une feature est accessible selon le rôle
 * Les features peuvent avoir un champ `minRole`
 * @param {{ name: string, label: string, minRole?: string }} feature
 * @param {string} userRole
 * @returns {boolean}
 */
export function canAccess(feature, userRole = 'guest') {
  const required = feature.minRole || 'user';
  return hasAccess(required, userRole);
}

/**
 * Filtre une liste de features selon le rôle
 * @param {Array<{ name: string, label: string, minRole?: string }>} features
 * @param {string} userRole
 * @returns {Array}
 */
export function getAccessibleFeatures(features, userRole = 'guest') {
  return features.filter((f) => canAccess(f, userRole));
}

/**
 * Composant conditionnel basé sur le rôle
 */
export default function DryRoleGuard({
  role = 'user',
  userRole,
  fallback = null,
  children,
}) {
  if (hasAccess(role, userRole)) {
    return children;
  }
  return fallback;
}
