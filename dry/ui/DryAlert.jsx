/**
 * DryAlert — Alertes et notifications réutilisables
 *
 * Variants :
 *   success, error, warning, info
 *
 * Exemple :
 *   <DryAlert variant="success" message="Opération réussie !" />
 *   <DryAlert variant="error" dismissible onDismiss={handleClose}>
 *     Une erreur est survenue
 *   </DryAlert>
 */

import { useState } from 'react';

const icons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const labels = {
  success: 'Succès',
  error: 'Erreur',
  warning: 'Attention',
  info: 'Info',
};

export default function DryAlert({
  variant = 'info',
  message,
  children,
  dismissible = false,
  onDismiss,
  className = '',
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className={`dry-alert dry-alert--${variant} ${className}`} role="alert">
      <span className="dry-alert-icon">{icons[variant]}</span>
      <div className="dry-alert-content">
        <strong className="dry-alert-label">{labels[variant]}</strong>
        {message && <span className="dry-alert-message">{message}</span>}
        {children}
      </div>
      {dismissible && (
        <button
          className="dry-alert-close"
          onClick={handleDismiss}
          aria-label="Fermer"
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
}
