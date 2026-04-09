import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, Product } from '../api/client';

function CreateModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (p: Product) => void;
}) {
  const [form, setForm] = useState({ name: '', display_name: '', description: '', approval_required: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const p = await apiClient.createProduct(form);
      onCreate(p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Create Product</div>
        {error && <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 14 }}>{error}</div>}
        <div className="form-group">
          <label>Name *</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="starter-plan" />
        </div>
        <div className="form-group">
          <label>Display Name</label>
          <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} placeholder="Starter Plan" />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input type="checkbox" id="approval" style={{ width: 'auto' }}
            checked={form.approval_required}
            onChange={e => setForm(p => ({ ...p, approval_required: e.target.checked }))} />
          <label htmlFor="approval" style={{ margin: 0, cursor: 'pointer' }}>Require approval for subscriptions</label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving || !form.name} onClick={submit}>
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
            Create Product
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    apiClient.listProducts()
      .then(setProducts)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="state-box"><div className="spinner" style={{ width: 28, height: 28 }} /></div>
  );
  if (error) return (
    <div className="state-box">
      <div className="state-icon">⚠️</div>
      <div className="state-title">Failed to load products</div>
      <div className="state-desc">{error}</div>
    </div>
  );

  return (
    <div>
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={p => { setProducts(prev => [p, ...prev]); setShowCreate(false); }}
        />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Products</div>
          <div className="page-subtitle">{products.length} product{products.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Product</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {products.length === 0 ? (
          <div className="state-box">
            <div className="state-icon">◫</div>
            <div className="state-title">No products yet</div>
            <div className="state-desc">Create a product and assign APIs to it.</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Approval</th>
                <th>Status</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.display_name ?? p.name}</div>
                    <div className="mono" style={{ marginTop: 2 }}>{p.name}</div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {p.description ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: p.approval_required ? 'var(--amber)' : 'var(--text-muted)' }}>
                      {p.approval_required ? '⚠ Required' : 'Auto-approve'}
                    </span>
                  </td>
                  <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/products/${p.id}`)}>
                      Manage
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
