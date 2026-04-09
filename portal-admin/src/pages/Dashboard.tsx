import React, { useEffect, useState } from 'react';
import { apiClient, Api, Product, Subscription, User } from '../api/client';

interface Stats {
  apis: number;
  activeApis: number;
  products: number;
  subscriptions: number;
  pendingSubscriptions: number;
  users: number;
}

function StatCard({ icon, label, value, sub, accent }: {
  icon: string; label: string; value: number | string;
  sub?: string; accent?: string;
}) {
  return (
    <div className="card" style={{ padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: '-0.03em', lineHeight: 1 }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>
          )}
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: accent ?? 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>{icon}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.listApis(),
      apiClient.listProducts(),
      apiClient.listSubscriptions(),
      apiClient.listUsers(),
    ])
      .then(([apis, products, subs, users]) => {
        setStats({
          apis: apis.length,
          activeApis: apis.filter((a: Api) => a.status === 'active').length,
          products: products.length,
          subscriptions: subs.length,
          pendingSubscriptions: subs.filter((s: Subscription) => s.status === 'pending').length,
          users: users.length,
        });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="state-box"><div className="spinner" style={{ width: 28, height: 28 }} /></div>
  );
  if (error) return (
    <div className="state-box">
      <div className="state-icon">⚠️</div>
      <div className="state-title">Failed to load dashboard</div>
      <div className="state-desc">{error}</div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Platform-wide overview</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        <StatCard icon="⬡" label="Total APIs" value={stats!.apis}
          sub={`${stats!.activeApis} active`} accent="#eff6ff" />
        <StatCard icon="◫" label="Products" value={stats!.products}
          accent="#f0fdf4" />
        <StatCard icon="◈" label="Subscriptions" value={stats!.subscriptions}
          sub={stats!.pendingSubscriptions > 0 ? `${stats!.pendingSubscriptions} pending approval` : 'all resolved'}
          accent={stats!.pendingSubscriptions > 0 ? '#fffbeb' : '#f0fdf4'} />
        <StatCard icon="◉" label="Users" value={stats!.users}
          accent="#fdf4ff" />
      </div>

      {stats!.pendingSubscriptions > 0 && (
        <div style={{
          marginTop: 20, padding: '14px 18px',
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, color: '#92400e',
        }}>
          <span>⚠️</span>
          <span>
            <strong>{stats!.pendingSubscriptions}</strong> subscription{stats!.pendingSubscriptions > 1 ? 's' : ''} awaiting approval.
            {' '}<a href="/subscriptions" style={{ color: '#d97706', fontWeight: 600 }}>Review now →</a>
          </span>
        </div>
      )}
    </div>
  );
}
