/**
 * DrySpinner — Indicateur de chargement réutilisable
 *
 * Variants :
 *   - default  => spinner bleu standard
 *   - overlay  => fond semi-transparent centré (pour les pages)
 *   - inline   => petit spinner dans le texte
 *   - button   => spinner blanc pour boutons en loading
 *
 * Exemple :
 *   <DrySpinner />
 *   <DrySpinner variant="overlay" text="Chargement des données…" />
 *   <DrySpinner variant="inline" size="sm" />
 */

const variants = {
  default: {
    container: 'dry-spinner-container',
    circle: 'dry-spinner dry-spinner--primary',
  },
  overlay: {
    container: 'dry-spinner-overlay',
    circle: 'dry-spinner dry-spinner--lg dry-spinner--primary',
  },
  inline: {
    container: 'dry-spinner-inline',
    circle: 'dry-spinner dry-spinner--sm dry-spinner--primary',
  },
  button: {
    container: 'dry-spinner-inline',
    circle: 'dry-spinner dry-spinner--sm dry-spinner--white',
  },
};

export default function DrySpinner({
  variant = 'default',
  size,
  text,
  className = '',
}) {
  const v = variants[variant] || variants.default;
  const sizeClass = size ? `dry-spinner--${size}` : '';

  return (
    <div className={`${v.container} ${className}`} role="status" aria-label={text || 'Chargement'}>
      <div className={`${v.circle} ${sizeClass}`} />
      {text && <span className="dry-spinner-text">{text}</span>}
    </div>
  );
}
