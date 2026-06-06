/**
 * DRY UI — Bibliothèque de composants réutilisables
 *
 * Utilisation :
 *   import { DryButton, DryInput, DrySelect, DryTable } from '../../dry/ui';
 *
 * Tous les composants acceptent :
 *   - className  pour surcharge CSS
 *   - style      pour styles inline
 *   - ...props   pour les props natives
 *
 * Documentation exhaustive dans chaque fichier de composant.
 */

export { default as DryButton } from './DryButton';
export { default as DryInput } from './DryInput';
export { default as DrySelect } from './DrySelect';
export { default as DryTable } from './DryTable';
export { default as DryCard } from './DryCard';
export { default as DryBadge } from './DryBadge';
export { default as DryModal } from './DryModal';
export { default as DryForm } from './DryForm';
export { default as DryNavbar } from './DryNavbar';
export { default as DrySpinner } from './DrySpinner';
export { default as DryAlert } from './DryAlert';
export { default as DryLayout } from './DryLayout';
export { default as DryRoleGuard, hasAccess, canAccess, getAccessibleFeatures } from './DryRoleGuard';

/**
 * Constantes partagées
 */
export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  CLIENT: 'client',
  USER: 'user',
  GUEST: 'guest',
};

export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Administrateur',
  manager: 'Manager',
  client: 'Client',
  user: 'Utilisateur',
  guest: 'Invité',
};
