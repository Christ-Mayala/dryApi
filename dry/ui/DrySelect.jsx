/**
 * DrySelect — Menu déroulant avec label et validation
 * 
 * @example
 * <DrySelect label="Catégorie" options={categories} value={cat} onChange={setCat} />
 * <DrySelect label="Statut" options={['actif','inactif']} value={status} error={err} />
 */

import React from 'react';

/**
 * @param {object}   props
 * @param {string}   props.label - Label du champ
 * @param {Array}    props.options - Options (strings ou [{value, label}])
 * @param {string}   props.value - Valeur sélectionnée
 * @param {Function} props.onChange - Handler
 * @param {string}   [props.error] - Message d'erreur
 * @param {boolean}  [props.required=false] - Champ obligatoire
 * @param {string}   [props.placeholder='Sélectionner...'] - Texte par défaut
 */
export default function DrySelect({
  label,
  options = [],
  value,
  onChange,
  error,
  required = false,
  placeholder = 'Sélectionner...',
  ...rest
}) {
  const normalized = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 13, fontWeight: 700,
          color: '#64748b', marginBottom: 6,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {label}
          {required && <span style={{ color: '#e53e3e', marginLeft: 4 }}>*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        required={required}
        style={{
          width: '100%', padding: '12px 16px',
          border: `2px solid ${error ? '#e53e3e' : '#e2e8f0'}`,
          borderRadius: 8, fontSize: 15,
          background: '#f8fafc', color: '#1e293b',
          fontFamily: 'inherit', cursor: 'pointer',
          outline: 'none', boxSizing: 'border-box',
        }}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {normalized.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#e53e3e' }}>{error}</p>}
    </div>
  );
}
