/**
 * DryNavbar — Barre de navigation avec liens et infos utilisateur
 * 
 * @example
 * <DryNavbar brand="DRY API" links={[{to:'/', label:'Accueil'}]} user={user} onLogout={logout} />
 */

import React from 'react';

/**
 * @param {object}   props
 * @param {string}   props.brand - Nom de la marque
 * @param {Array}    props.links - [{to, label, icon}]
 * @param {object}   [props.user] - Utilisateur connecté
 * @param {string}   [props.role] - Rôle actif (admin/client)
 * @param {Function} props.onLogout - Handler déconnexion
 * @param {Function} [props.onRoleSwitch] - Handler changement de rôle
 */
export default function DryNavbar({ brand, links = [], user, role, onLogout, onRoleSwitch }) {
  return (
    <nav style={{
      background: 'linear-gradient(135deg, #1e293b, #0f172a)',
      color: 'white',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      minHeight: 56,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <a href="/" style={{ fontSize: 20, fontWeight: 800, color: 'white', textDecoration: 'none', letterSpacing: '-0.03em' }}>
          {brand}
        </a>
        <div style={{ display: 'flex', gap: 8 }}>
          {links.map((link) => (
            <a key={link.to} href={link.to} style={{
              color: '#cbd5e1', fontWeight: 600, fontSize: 14,
              padding: '8px 14px', borderRadius: 8,
              textDecoration: 'none', transition: 'all 0.2s',
            }}
              onMouseEnter={(e) => { e.target.style.color = 'white'; e.target.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.target.style.color = '#cbd5e1'; e.target.style.background = 'transparent'; }}
            >
              {link.icon && <span style={{ marginRight: 6 }}>{link.icon}</span>}
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {onRoleSwitch && role && (
          <select value={role} onChange={(e) => onRoleSwitch(e.target.value)} style={{
            background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none',
          }}>
            <option value="admin" style={{ color: '#1e293b' }}>👑 Admin</option>
            <option value="client" style={{ color: '#1e293b' }}>👤 Client</option>
          </select>
        )}
        {user && (
          <span style={{ color: '#94a3b8', fontSize: 13 }}>{user.email}</span>
        )}
        <button onClick={onLogout} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.3)',
          color: 'white', padding: '6px 14px', borderRadius: 8,
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.2s',
        }}
          onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
        >
          Déconnexion
        </button>
      </div>
    </nav>
  );
}
