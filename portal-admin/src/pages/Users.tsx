import React, { useEffect, useState } from 'react';
import { apiClient, User } from '../api/client';

const ALL_ROLES = ['admin', 'publisher', 'developer'] as const;
type Role = typeof ALL_ROLES[number];

function RoleModal({ user, onClose, onSave }: {
  user: User;
  onClose: () => void;
  onSave: (updated: User) => void;
}) {
  const [roles, setRoles] = useState<Set<Role>>(new Set(user.roles as Role[]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (role: Role) =>
    setRoles(prev => { const s = new Set(prev); s.has(role) ? s.delete(role) : s.add(role); return s; });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiClient.updateUserRoles(user.id, [...roles]);
      onSave(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update roles');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Manage Roles</div>
        <div style={{ marginBottom: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
          {user.display_name ?? user.email}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>{user.email}</div>

        {error && <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 14 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ALL_ROLES.map(role => (
            <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', border: '1px solid var(--border)',
              borderRadius: 8, cursor: 'pointer',
              background: roles.has(role) ? 'var(--accent-light)' : 'var(--surface)',
              transition: 'all 0.12s',
            }}>
              <input type="checkbox" style={{ width: 'auto' }}
                checked={roles.has(role)} onChange={() => toggle(role)} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{role}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  {role === 'admin' && 'Full platform access — manage all APIs, products, users'}
                  {role === 'publisher' && 'Manage own APIs and approve subscriptions for owned products'}
                  {role === 'developer' && 'Browse catalog, subscribe to products, view own keys'}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
            Save Roles
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<User | null>(null);

  useEffect(() => {
    apiClient.listUsers()
      .then(setUsers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="state-box"><div className="spinner" style={{ width: 28, height: 28 }} /></div>
  );
  if (error) return (
    <div className="state-box">
      <div className="state-icon">⚠️</div>
      <div className="state-title">Failed to load users</div>
      <div className="state-desc">{error}</div>
    </div>
  );

  return (
    <div>
      {editing && (
        <RoleModal
          user={editing}
          onClose={() => setEditing(null)}
          onSave={updated => {
            setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
            setEditing(null);
          }}
        />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Users</div>
          <div className="page-subtitle">{users.length} user{users.length !== 1 ? 's' : ''} synced from Entra ID</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {users.length === 0 ? (
          <div className="state-box">
            <div className="state-icon">◉</div>
            <div className="state-title">No users yet</div>
            <div className="state-desc">Users are synced from Entra ID on first login.</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Joined</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: '#e0e7ff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: '#3730a3', flexShrink: 0,
                      }}>
                        {(user.display_name ?? user.email).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {user.display_name ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user.email}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {user.roles.length === 0
                        ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No roles</span>
                        : user.roles.map(r => (
                          <span key={r} className={`badge badge-${r}`}>{r}</span>
                        ))
                      }
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(user)}>
                      Roles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
