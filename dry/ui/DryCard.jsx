/**
 * DryCard — Conteneur de carte avec style DRY
 * 
 * @example
 * <DryCard><h2>Titre</h2><p>Contenu</p></DryCard>
 * <DryCard padding={32}><DryCard title="Carte avec titre">Contenu</DryCard></DryCard>
 */

import React from 'react';

/**
 * @param {object}   props
 * @param {string}   [props.title] - Titre optionnel
 * @param {ReactNode} props.children - Contenu
 * @param {number}   [props.padding=24] - Padding interne
 * @param {boolean}  [props.hoverable=false] - Effet hover
 * @param {object}   [props.style] - Styles supplémentaires
 */
export default function DryCard({ title, children, padding = 24, hoverable = false, style }) {
  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 12,
      padding,
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
      border: '1px solid #e2e8f0',
      transition: hoverable ? 'all 0.2s ease' : undefined,
      cursor: hoverable ? 'pointer' : undefined,
      ...style,
    }}
      onMouseEnter={(e) => { if (hoverable) { e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
      onMouseLeave={(e) => { if (hoverable) { e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'none'; } }}
    >
      {title && (
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
