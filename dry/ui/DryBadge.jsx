/**
 * DryBadge — Badge de statut avec couleurs automatiques
 * 
 * @example
 * <DryBadge status="active" />  → vert
 * <DryBadge status="pending" /> → orange
 * <DryBadge status="error" />   → rouge
 * <DryBadge label="Pro" variant="primary" />
 */

import React from 'react';

const COLORS = {
  success: { bg: '#e8f5e9', fg: '#1b5e20', border: '#81c784' },
  warning: { bg: '#fff3e0', fg: '#e65100', border: '#ffb74d' },
  error:   { bg: '#ffebee', fg: '#c62828', border: '#ef9a9a' },
  info:    { bg: '#e3f2fd', fg: '#0d47a1', border: '#90caf9' },
  primary: { bg: '#eff6ff', fg: '#1e3a8a', border: '#93c5fd' },
};

const STATUS_MAP = {
  active: 'success',   ok: 'success',  true: 'success',  yes: 'success',
  inactive: 'warning', pending: 'warning',  waiting: 'warning',
  error: 'error',      failed: 'error',     false: 'error',  no: 'error',
  info: 'info',        disabled: 'info',
};

/**
 * @param {object} props
 * @param {string} [props.status] - Statut (auto-détecte la couleur)
 * @param {string} [props.label] - Texte affiché (ou status si absent)
 * @param {string} [props.variant] - Variant forcée (success/warning/error/info/primary)
 */
export default function DryBadge({ status, label, variant }) {
  const v = variant || STATUS_MAP[String(status).toLowerCase()] || 'primary';
  const c = COLORS[v] || COLORS.primary;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 12px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      background: c.bg,
      color: c.fg,
      border: `1px solid ${c.border}`,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: c.fg, marginRight: 6,
        opacity: 0.7,
      }} />
      {label || status}
    </span>
  );
}
