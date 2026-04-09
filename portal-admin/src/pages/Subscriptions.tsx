import React, { useEffect, useState } from 'react';
import { apiClient, Subscription } from '../api/client';

type Action = 'approve' | 'reject' | 'suspend';

export default function Subscriptions() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [filter, setFilter] = useState<Subscription['status'] | 'all'>('all');

  useEffect(() => {
    apiClient.listSubscriptions()
      .then(setSubs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const act = async (sub: Subscription, action: Action) => {
    setActing(sub.id);
    try {
      if (action === 'approve') await apiClient.approveSubscription(sub.id);
      else if (action === 'reject') await apiClient.rejectSubscription(sub.id);
      else await apiClient.suspendSubscription(sub.id);
      setSubs(prev => prev.map(s => s.id === sub.id
        ? { ...s, status: action === 'approve' ? 'active' : action === 'reject' ? 'rejected' : 'suspended' }
        : s
      ));
    } finally {
      setActing(null);
    }
  };

  const counts = {
    all: subs.length,
    pending: subs.filter(s => s.status === 'pending').length,
    active: subs.filter(s => s.status === 'active').length,
    suspended: subs.filter(s => s.status === 'suspended').length,
    rejected: subs.filter(s => s.status === 'rejected').length,
  };

  const visible = filter === 'all' ? subs : subs.filter(s => s.status === filter);

  if (loading) return (
    <div className="state-box"><div className="spinner" style={{ width: 28, height: 28 }} /></div>
  );
  if (error) return (
    <div className="state-box">
      <div className="state-icon">⚠️</div>
      <div className="state-title">Failed to load subscriptions</div>
      <div className="state-desc">{error}</div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Subscriptions</div>
          <div className="page-subtitle">{subs.length} total · {counts.pending} pending</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['all', 'pending', 'active', 'suspended', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
              background: filter === f ? 'var(--accent)' : 'var(--surface)',
              color: filter === f ? '#fff' : 'var(--text-secondary)',
              borderColor: filter === f ? 'var(--accent)' : 'var(--border-strong)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {' '}
            <span style={{ opacity: 0.75 }}>({counts[f as keyof typeof counts]})</span>
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {visible.length === 0 ? (
          <div className="state-box">
            <div className="state-icon">◈</div>
            <div className="state-title">No subscriptions</div>
            <div className="state-desc">No subscriptions match this filter.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Subscription</th>
                  <th>Developer</th>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ width: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(sub => (
                  <tr key={sub.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{sub.name}</div>
                      <div className="mono" style={{ marginTop: 2 }}>{sub.id.slice(0, 8)}…</div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {sub.developer?.display_name ?? sub.developer?.email ?? (
                        <span className="mono">{sub.developer_id.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {sub.product?.display_name ?? sub.product?.name ?? (
                        <span className="mono">{sub.product_id.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td><span className={`badge badge-${sub.status}`}>{sub.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(sub.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {sub.status === 'pending' && (
                          <>
                            <button className="btn btn-success btn-sm"
                              disabled={acting === sub.id}
                              onClick={() => act(sub, 'approve')}>
                              {acting === sub.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '✓ Approve'}
                            </button>
                            <button className="btn btn-danger btn-sm"
                              disabled={acting === sub.id}
                              onClick={() => act(sub, 'reject')}>
                              ✕ Reject
                            </button>
                          </>
                        )}
                        {sub.status === 'active' && (
                          <button className="btn btn-danger btn-sm"
                            disabled={acting === sub.id}
                            onClick={() => act(sub, 'suspend')}>
                            Suspend
                          </button>
                        )}
                        {(sub.status === 'suspended' || sub.status === 'rejected') && (
                          <button className="btn btn-success btn-sm"
                            disabled={acting === sub.id}
                            onClick={() => act(sub, 'approve')}>
                            Reinstate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
