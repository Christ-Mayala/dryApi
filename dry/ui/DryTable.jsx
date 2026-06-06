/**
 * DryTable — Tableau dynamique avec colonnes automatiques et actions
 * 
 * @example
 * <DryTable data={items} onEdit={(id) => ...} onDelete={(id) => ...} />
 * <DryTable data={items} columns={['name','email']} exclude={['__v','hash']} />
 */

import React from 'react';

const cellStyle = {
  padding: '12px 16px',
  borderBottom: '1px solid #f8fafc',
  fontSize: 14,
  color: '#334155',
};

/**
 * @param {object}   props
 * @param {Array}    props.data - Données à afficher
 * @param {Array}    [props.columns] - Colonnes spécifiques (auto si omis)
 * @param {Array}    [props.exclude] - Champs à exclure
 * @param {Function} [props.onEdit] - Handler édition (id) => void
 * @param {Function} [props.onDelete] - Handler suppression (id) => void
 * @param {string}   [props.emptyText='Aucun élément'] - Texte si vide
 * @param {boolean}  [props.loading=false] - État de chargement
 */
export default function DryTable({
  data = [],
  columns,
  exclude = ['__v', 'password', 'hash', 'deletedAt'],
  onEdit,
  onDelete,
  emptyText = 'Aucun élément',
  loading = false,
}) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        <DrySpinnerInline /> Chargement...
      </div>
    );
  }

  if (!data.length) {
    return (
      <p style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
        {emptyText}
      </p>
    );
  }

  const cols = columns || Object.keys(data[0]).filter((k) => !exclude.includes(k)).slice(0, 6);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {cols.map((col) => (
              <th key={col} style={{
                textAlign: 'left', padding: '12px 16px',
                fontWeight: 700, fontSize: 12, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                borderBottom: '2px solid #e2e8f0',
              }}>
                {col}
              </th>
            ))}
            {(onEdit || onDelete) && (
              <th style={{ width: 100, ...cellStyle, textAlign: 'right' }}>Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const id = item._id || item.id;
            return (
              <tr key={id} style={{ transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {cols.map((col) => (
                  <td key={col} style={cellStyle}>
                    {String(item[col] ?? '').slice(0, 80)}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td style={{ ...cellStyle, textAlign: 'right' }}>
                    {onEdit && (
                      <button onClick={() => onEdit(id)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#3182ce', marginRight: 8 }}>
                        ✏️
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(id)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#e53e3e' }}>
                        🗑️
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DrySpinnerInline() {
  return <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>;
}
