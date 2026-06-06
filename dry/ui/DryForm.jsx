/**
 * DryForm — Formulaire avec gestion de soumission
 * 
 * @example
 * <DryForm onSubmit={handleSubmit} loading={saving}>
 *   <DryInput label="Nom" value={name} onChange={setName} required />
 *   <DryButton type="submit">Enregistrer</DryButton>
 * </DryForm>
 */

import React from 'react';

/**
 * @param {object}   props
 * @param {Function} props.onSubmit - Handler de soumission
 * @param {boolean}  [props.loading=false] - État de chargement
 * @param {ReactNode} props.children - Contenu du formulaire
 * @param {string}   [props.error] - Erreur générale
 * @param {number}   [props.maxWidth] - Largeur max
 */
export default function DryForm({ onSubmit, loading = false, children, error, maxWidth }) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!loading) onSubmit?.(e); }}
      style={{ maxWidth: maxWidth || '100%', width: '100%' }}
    >
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 16,
          background: '#ffebee', color: '#c62828',
          borderRadius: 8, fontSize: 14, fontWeight: 600,
          border: '1px solid #ef9a9a',
        }}>
          {error}
        </div>
      )}
      {children}
    </form>
  );
}
