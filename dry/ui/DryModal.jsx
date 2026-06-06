/**
 * DryModal — Boîte de dialogue modale
 * 
 * @example
 * <DryModal open={isOpen} onClose={() => setOpen(false)} title="Confirmer">
 *   <p>Voulez-vous vraiment supprimer ?</p>
 *   <DryButton variant="danger">Supprimer</DryButton>
 * </DryModal>
 */

import React, { useEffect } from 'react';

/**
 * @param {object}   props
 * @param {boolean}  props.open - État d'ouverture
 * @param {Function} props.onClose - Handler de fermeture
 * @param {string}   [props.title] - Titre de la modale
 * @param {ReactNode} props.children - Contenu
 * @param {number}   [props.maxWidth=500] - Largeur max en px
 */
export default function DryModal({ open, onClose, title, children, maxWidth = 500 }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', handleKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15,23,42,0.4)',
        backdropFilter: 'blur(4px)',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 16,
        padding: 32, maxWidth, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          {title && <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{title}</h2>}
          <button onClick={onClose} style={{
            background: '#f1f5f9', border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#64748b', marginLeft: 'auto', flexShrink: 0,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
