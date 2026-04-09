import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, Product, Api } from '../api/client';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [allApis, setAllApis] = useState<Api[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', display_name: '', description: '',
    status: 'published' as Product['status'], approval_required: false });

  useEffect(() => {
    Promise.all([apiClient.getProduct(id!), apiClient.listApis()])
      .then(([p, apis]) => {
        setProduct(p);
        setAllApis(apis);
        setAssignedIds(new Set((p.apis ?? []).map((a: Api) => a.id)));
        setForm({
          name: p.name, display_name: p.display_name ?? '',
          description: p.description ?? '', status: p.status,
          approval_required: p.approval_required,
        });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await apiClient.updateProduct(id!, form);
      navigate('/products');
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleApi = async (api: Api) => {
    if (assignedIds.has(api.id)) {
      await apiClient.removeApiFromProduct(id!, api.id);
      setAssignedIds(prev => { const s = new Set(prev); s.delete(api.id); return s; });
    } else {
      await apiClient.addApiToProduct(id!, api.id);
      setAssignedIds(prev => new Set([...prev, api.id]));
    }
  };

  if (loading) return (
    <div className="state-box"><div className="spinner" style={{ width: 28, height: 28 }} /></div>
  );
  if (error) return (
    <div className="state-box">
      <div className="state-icon">⚠️</div>
      <div className="state-title">Failed to load product</div>
      <div className="state-desc">{error}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div>
          <div className="page-title">{product?.display_name ?? product?.name}</div>
          <div className="page-subtitle">{assignedIds.size} API{assignedIds.size !== 1 ? 's' : ''} assigned</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/products')}>Cancel</button>
          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
            Save Changes
          </button>
        </div>
      </div>

      {saveError && (
        <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid #fca5a5',
          borderRadius: 6, fontSize: 13, color: 'var(--red)', marginBottom: 20 }}>
          {saveError}
        </div>
      )}

      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
          letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 20 }}>
          Product Details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label>Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Display Name</label>
            <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Product['status'] }))}>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
            <input type="checkbox" id="approval" style={{ width: 'auto' }}
              checked={form.approval_required}
              onChange={e => setForm(p => ({ ...p, approval_required: e.target.checked }))} />
            <label htmlFor="approval" style={{ margin: 0, cursor: 'pointer' }}>Require subscription approval</label>
          </div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
            letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            API Assignments
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            Toggle APIs to include/exclude from this product
          </div>
        </div>
        {allApis.length === 0 ? (
          <div className="state-box" style={{ padding: '32px 24px' }}>
            <div className="state-desc">No APIs registered yet.</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>API</th>
                <th>Base Path</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allApis.map(api => (
                <tr key={api.id} style={{ cursor: 'pointer' }} onClick={() => toggleApi(api)}>
                  <td>
                    <input type="checkbox" style={{ width: 'auto', cursor: 'pointer' }}
                      checked={assignedIds.has(api.id)}
                      onChange={() => toggleApi(api)}
                      onClick={e => e.stopPropagation()} />
                  </td>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{api.display_name ?? api.name}</td>
                  <td><span className="mono">{api.base_path}</span></td>
                  <td><span className={`badge badge-${api.status}`}>{api.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
