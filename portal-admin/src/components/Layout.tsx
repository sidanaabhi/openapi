import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';

const NAV = [
  { to: '/dashboard',     icon: '▦',  label: 'Dashboard'      },
  { to: '/apis',          icon: '⬡',  label: 'APIs'           },
  { to: '/products',      icon: '◫',  label: 'Products'       },
  { to: '/subscriptions', icon: '◈',  label: 'Subscriptions'  },
  { to: '/users',         icon: '◉',  label: 'Users'          },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { instance, accounts } = useMsal();
  const location = useLocation();
  const account = accounts[0];
  const initials = account?.name
    ? account.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const pageTitle = NAV.find(n => location.pathname.startsWith(n.to))?.label ?? 'Admin';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: 'var(--sidebar-bg)',
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid #1e293b',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#2563eb', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 14, color: '#fff', flexShrink: 0,
            }}>⚡</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                API Platform
              </div>
              <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Admin
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, color: '#334155', letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '8px 10px 6px', fontWeight: 600 }}>
            Management
          </div>
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 6,
                marginBottom: 2, textDecoration: 'none',
                fontSize: 13, fontWeight: 500,
                color: isActive ? '#f8fafc' : '#94a3b8',
                background: isActive ? '#1d4ed8' : 'transparent',
                transition: 'all 0.12s',
              })}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#1d4ed8', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 11, fontWeight: 700,
              color: '#fff', flexShrink: 0,
            }}>{initials}</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {account?.name ?? account?.username ?? 'Admin'}
              </div>
              <div style={{ fontSize: 10, color: '#475569' }}>Administrator</div>
            </div>
            <button
              onClick={() => instance.logoutRedirect()}
              title="Sign out"
              style={{
                background: 'transparent', border: 'none', color: '#475569',
                cursor: 'pointer', fontSize: 14, padding: '2px 4px',
                borderRadius: 4, transition: 'color 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
              onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
            >⏻</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{
          height: 52, background: '#fff', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 28px',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {pageTitle}
          </span>
        </header>

        {/* Content */}
        <main className="content-area" style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          <div className="fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
