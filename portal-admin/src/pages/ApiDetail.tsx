import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, Api, Product } from '../api/client';

type FormData = Omit<Api, 'id' | 'created_at' | 'updated_at' | 'openapi_spec'>;

export default function ApiDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [api, setApi] = useState<Api | null>(null);
  const [form, setForm] = useState<Partial<FormData>>({
    name: '', display_name: '', description: '', version: '',
    base_path: '', backend_url: '', status: 'active',
    connect_timeout_ms: null, response_timeout_ms: null, openapi_raw: null, owner_id: null,
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSpec, setShowSpec] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [assignedProductIds, setAssignedProductIds] = useState<Set<string>>(new Set());
  const [togglingProduct, setTogglingProduct] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    Promise.all([apiClient.getApi(id!), apiClient.listProducts()])
      .then(([data, products]) => {
        setApi(data);
        setForm({
          name: data.name,
          display_name: data.display_name ?? '',
          description: data.description ?? '',
          version: data.version ?? '',
          base_path: data.base_path,
          backend_url: data.backend_url,
          status: data.status,
          connect_timeout_ms: data.connect_timeout_ms,
          response_timeout_ms: data.response_timeout_ms,
          openapi_raw: data.openapi_raw,
          owner_id: data.owner_id,
        });
        setAllProducts(products);
        setAssignedProductIds(new Set(
          products.filter(p => (p.apis ?? []).some(a => a.id === id)).map(p => p.id)
        ));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const set = (field: keyof FormData, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (isNew) {
        await apiClient.createApi(form);
      } else {
        await apiClient.updateApi(id!, form);
      }
      navigate('/apis');
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = async (product: Product) => {
    setTogglingProduct(product.id);
    try {
      if (assignedProductIds.has(product.id)) {
        await apiClient.removeApiFromProduct(product.id, id!);
        setAssignedProductIds(prev => { const s = new Set(prev); s.delete(product.id); return s; });
      } else {
        await apiClient.addApiToProduct(product.id, id!);
        setAssignedProductIds(prev => new Set([...prev, product.id]));
      }
    } finally {
      setTogglingProduct(null);
    }
  };

  if (loading) return (
    <div className="state-box"><div className="spinner" style={{ width: 28, height: 28 }} /></div>
  );
  if (error) return (
    <div className="state-box">
      <div className="state-icon">⚠️</div>
      <div className="state-title">Failed to load API</div>
      <div className="state-desc">{error}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div>
          <div className="page-title">{isNew ? 'New API' : (api?.display_name ?? api?.name)}</div>
          {!isNew && <div className="page-subtitle mono">{api?.base_path}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/apis')}>Cancel</button>
          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
            {isNew ? 'Create API' : 'Save Changes'}
          </button>
        </div>
      </div>

      {saveError && (
        <div style={{ padding: '10px 14px', background: 'var(--red-light)',
          border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13,
          color: 'var(--red)', marginBottom: 20 }}>
          {saveError}
        </div>
      )}

      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
          letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 20 }}>
          Basic Info
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label>Name *</label>
            <input value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="petstore" />
          </div>
          <div className="form-group">
            <label>Display Name</label>
            <input value={form.display_name ?? ''} onChange={e => set('display_name', e.target.value)} placeholder="Petstore API" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Description</label>
            <textarea rows={2} value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Version</label>
            <input value={form.version ?? ''} onChange={e => set('version', e.target.value)} placeholder="v1" />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
          letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 20 }}>
          Routing
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label>Base Path *</label>
            <input value={form.base_path ?? ''} onChange={e => set('base_path', e.target.value)} placeholder="/v1/petstore" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
          </div>
          <div className="form-group">
            <label>Backend URL *</label>
            <input value={form.backend_url ?? ''} onChange={e => set('backend_url', e.target.value)} placeholder="http://petstore-svc:8080" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
          </div>
          <div className="form-group">
            <label>Connect Timeout (ms)</label>
            <input type="number" value={form.connect_timeout_ms ?? ''} placeholder="5000 (default)"
              onChange={e => set('connect_timeout_ms', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="form-group">
            <label>Response Timeout (ms)</label>
            <input type="number" value={form.response_timeout_ms ?? ''} placeholder="15000 (default)"
              onChange={e => set('response_timeout_ms', e.target.value ? Number(e.target.value) : null)} />
          </div>
        </div>
      </div>

      {!isNew && (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
              letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              Product Assignments
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              Toggle products to include/exclude this API
            </div>
          </div>
          {allProducts.length === 0 ? (
            <div className="state-box" style={{ padding: '32px 24px' }}>
              <div className="state-desc">No products yet. <a href="/products" style={{ color: 'var(--blue)' }}>Create one first.</a></div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Approval</th>
                </tr>
              </thead>
              <tbody>
                {allProducts.map(p => (
                  <tr key={p.id} style={{ cursor: togglingProduct === p.id ? 'wait' : 'pointer' }}
                    onClick={() => !togglingProduct && toggleProduct(p)}>
                    <td>
                      <input type="checkbox" style={{ width: 'auto', cursor: 'pointer' }}
                        checked={assignedProductIds.has(p.id)}
                        onChange={() => toggleProduct(p)}
                        onClick={e => e.stopPropagation()}
                        disabled={togglingProduct === p.id} />
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{p.display_name ?? p.name}</div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.name}</div>
                    </td>
                    <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                    <td style={{ fontSize: 12, color: p.approval_required ? 'var(--amber)' : 'var(--text-muted)' }}>
                      {p.approval_required ? '⚠ Required' : 'Auto-approve'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!isNew && api?.openapi_raw && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
              letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              OpenAPI Spec
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowSpec(!showSpec)}>
              {showSpec ? 'Hide' : 'View Spec'}
            </button>
          </div>
          {showSpec && (
            <pre style={{
              padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--text-secondary)', overflowX: 'auto', maxHeight: 400,
              background: '#f8fafc', margin: 0,
            }}>
              {api.openapi_raw}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
