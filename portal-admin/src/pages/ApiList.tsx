import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, Api } from '../api/client';

export default function ApiList() {
  const [apis, setApis] = useState<Api[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    apiClient.listApis()
      .then(setApis)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleStatus = async (api: Api) => {
    setToggling(api.id);
    try {
      const updated = await apiClient.updateApi(api.id, {
        status: api.status === 'active' ? 'inactive' : 'active',
      });
      setApis(prev => prev.map(a => a.id === api.id ? updated : a));
    } finally {
      setToggling(null);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const api = await apiClient.importSpec(fd);
      setApis(prev => [api, ...prev]);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) return (
    <div className="state-box"><div className="spinner" style={{ width: 28, height: 28 }} /></div>
  );
  if (error) return (
    <div className="state-box">
      <div className="state-icon">⚠️</div>
      <div className="state-title">Failed to load APIs</div>
      <div className="state-desc">{error}</div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">APIs</div>
          <div className="page-subtitle">{apis.length} API{apis.length !== 1 ? 's' : ''} registered</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {importError && (
            <span style={{ fontSize: 12, color: 'var(--red)' }}>{importError}</span>
          )}
          <input ref={fileRef} type="file" accept=".yaml,.yml,.json"
            style={{ display: 'none' }} onChange={handleImport} />
          <button className="btn btn-ghost" disabled={importing}
            onClick={() => fileRef.current?.click()}>
            {importing ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '↑'}
            Import OpenAPI
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/apis/new')}>
            + New API
          </button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {apis.length === 0 ? (
          <div className="state-box">
            <div className="state-icon">⬡</div>
            <div className="state-title">No APIs yet</div>
            <div className="state-desc">Import an OpenAPI spec or create one manually.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Base Path</th>
                  <th>Version</th>
                  <th>Backend URL</th>
                  <th>Status</th>
                  <th style={{ width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apis.map(api => (
                  <tr key={api.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {api.display_name ?? api.name}
                      </div>
                      {api.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)',
                          marginTop: 2, maxWidth: 260,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {api.description}
                        </div>
                      )}
                    </td>
                    <td><span className="mono">{api.base_path}</span></td>
                    <td><span className="mono">{api.version ?? '—'}</span></td>
                    <td>
                      <span className="mono" style={{
                        maxWidth: 200, overflow: 'hidden',
                        textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap',
                      }}>{api.backend_url}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${api.status}`}>
                        {api.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => navigate(`/apis/${api.id}`)}>
                          Edit
                        </button>
                        <button
                          className={`btn btn-sm ${api.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                          disabled={toggling === api.id}
                          onClick={() => toggleStatus(api)}
                        >
                          {toggling === api.id
                            ? <span className="spinner" style={{ width: 12, height: 12 }} />
                            : api.status === 'active' ? 'Disable' : 'Enable'
                          }
                        </button>
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
