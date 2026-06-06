/**
 * DryButton — Bouton réutilisable avec variants
 * 
 * @example
 * <DryButton variant="primary" onClick={handleClick}>Enregistrer</DryButton>
 * <DryButton variant="danger" size="sm">Supprimer</DryButton>
 * <DryButton variant="outline" loading>Chargement...</DryButton>
 */

import React from 'react';

const VARIANTS = {
  primary: { bg: '#3182ce', color: 'white', hover: '#2c5282' },
  danger:  { bg: '#e53e3e', color: 'white', hover: '#c53030' },
  success: { bg: '#38a169', color: 'white', hover: '#2f855a' },
  warning: { bg: '#d69e2e', color: 'white', hover: '#b7791f' },
  outline: { bg: 'transparent', color: '#1e293b', hover: '#f8fafc', border: '#e2e8f0' },
  ghost:   { bg: 'transparent', color: '#64748b', hover: '#f1f5f9', border: 'transparent' },
};

const SIZES = {
  sm: { padding: '6px 14px', fontSize: 13 },
  md: { padding: '10px 20px', fontSize: 14 },
  lg: { padding: '14px 28px', fontSize: 16 },
};

/**
 * @param {object}   props
 * @param {string}   [props.variant='primary'] - Variant de couleur
 * @param {string}   [props.size='md'] - Taille du bouton
 * @param {boolean}  [props.loading=false] - État de chargement
 * @param {boolean}  [props.disabled=false] - Désactivé
 * @param {boolean}  [props.fullWidth=false] - Pleine largeur
 * @param {Function} props.onClick - Handler de clic
 * @param {string}   [props.className=''] - Classes CSS supplémentaires
 * @param {ReactNode} props.children - Contenu du bouton
 */
export default function DryButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  className = '',
  children,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;

  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...s,
    fontWeight: 600,
    border: v.border ? `1px solid ${v.border}` : 'none',
    borderRadius: 8,
    cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
    opacity: (disabled || loading) ? 0.6 : 1,
    background: v.bg,
    color: v.color,
    width: fullWidth ? '100%' : undefined,
    transition: 'all 0.2s ease',
    textDecoration: 'none',
    fontFamily: 'inherit',
  };

  return (
    <button
      style={style}
      onClick={onClick}
      disabled={disabled || loading}
      className={className}
      onMouseEnter={(e) => { if (!disabled && !loading) e.target.style.background = v.hover; }}
      onMouseLeave={(e) => { if (!disabled && !loading) e.target.style.background = v.bg; }}
      {...rest}
    >
      {loading && <DrySpinner size={14} />}
      {children}
    </button>
  );
}

// Mini spinner pour le bouton loading
function DrySpinner({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </svg>
  );
}
