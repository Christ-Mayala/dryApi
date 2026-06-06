/**
 * DryInput — Champ de saisie avec label et gestion d'erreur
 * 
 * @example
 * <DryInput label="Email" value={email} onChange={setEmail} error={errors.email} />
 * <DryInput label="Mot de passe" type="password" required helper="6 caractères minimum" />
 */

import React from 'react';

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  border: '2px solid #e2e8f0',
  borderRadius: 8,
  fontSize: 15,
  transition: 'all 0.2s ease',
  background: '#f8fafc',
  color: '#1e293b',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

/**
 * @param {object}  props
 * @param {string}  props.label - Label du champ
 * @param {string}  [props.type='text'] - Type HTML (text, email, password, number, date)
 * @param {string}  props.value - Valeur contrôlée
 * @param {Function} props.onChange - Handler de changement
 * @param {string}  [props.error] - Message d'erreur
 * @param {string}  [props.helper] - Texte d'aide
 * @param {boolean} [props.required=false] - Champ obligatoire
 * @param {string}  [props.placeholder] - Placeholder
 * @param {boolean} [props.disabled=false] - Désactivé
 */
export default function DryInput({
  label,
  type = 'text',
  value,
  onChange,
  error,
  helper,
  required = false,
  placeholder,
  disabled = false,
  ...rest
}) {
  const hasError = !!error;

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 700,
          color: '#64748b',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {label}
          {required && <span style={{ color: '#e53e3e', marginLeft: 4 }}>*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        style={{
          ...inputStyle,
          borderColor: hasError ? '#e53e3e' : '#e2e8f0',
          background: disabled ? '#f1f5f9' : '#f8fafc',
        }}
        onFocus={(e) => { if (!hasError) e.target.style.borderColor = '#3182ce'; e.target.style.background = 'white'; }}
        onBlur={(e) => { if (!hasError) e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
        {...rest}
      />
      {hasError && (
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#e53e3e' }}>{error}</p>
      )}
      {helper && !hasError && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>{helper}</p>
      )}
    </div>
  );
}
