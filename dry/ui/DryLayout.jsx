/**
 * DryLayout — Layout applicatif avec sidebar, navbar et rôle guard intégré
 *
 * Props :
 *   role        — 'admin' | 'client' (optionnel, si non fourni pas de guard)
 *   appName     — nom de l'application (ex: "SCIM")
 *   features    — [{ name, label }] pour la navigation sidebar
 *   userRole    — rôle courant de l'utilisateur
 *   onLogout    — callback de déconnexion
 *   children    — contenu principal
 */

import DryNavbar from './DryNavbar';
import { hasAccess } from './DryRoleGuard';

export default function DryLayout({
  role,
  appName = 'DRY App',
  features = [],
  userRole,
  onLogout,
  children,
  className = '',
}) {
  const canAccess = !role || hasAccess(role, userRole);

  if (!canAccess) {
    return (
      <div className="dry-layout dry-layout--denied">
        <div className="dry-denied-card">
          <span className="dry-denied-icon">🔒</span>
          <h2>Accès refusé</h2>
          <p>Vous n'avez pas les droits nécessaires pour accéder à cette section.</p>
          <p className="dry-denied-hint">
            Rôle requis : <strong>{role}</strong> | Votre rôle : <strong>{userRole || 'non connecté'}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`dry-layout ${className}`}>
      <DryNavbar appName={appName} features={features} onLogout={onLogout} />
      <main className="dry-layout-main">
        {children}
      </main>
    </div>
  );
}
