import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useMsal, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from './auth/msalConfig';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ApiList from './pages/ApiList';
import ApiDetail from './pages/ApiDetail';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import Subscriptions from './pages/Subscriptions';
import Users from './pages/Users';

function LoginPage() {
  const { instance, inProgress } = useMsal();
  const loading = inProgress !== InteractionStatus.None;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '48px 40px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.35)', width: 380, textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: '#2563eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 22,
        }}>⚡</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
          API Platform
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 28px' }}>
          Admin Portal — sign in with your organisation account
        </p>
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: 14 }}
          disabled={loading}
          onClick={() => instance.loginRedirect(loginRequest)}
        >
          {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '→ Sign in with Microsoft'}
        </button>
      </div>
    </div>
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { instance } = useMsal();
  const account = instance.getActiveAccount();

  if (!account) return <Navigate to="/" replace />;

  // Check admin role from ID token claims — no fallback for missing roles
  const idTokenClaims = account.idTokenClaims as Record<string, unknown> | undefined;
  const roles: string[] = (idTokenClaims?.roles as string[]) ?? [];
  const isAdmin = roles.includes('admin');

  if (!isAdmin) {
    return (
      <div className="state-box" style={{ minHeight: '100vh' }}>
        <div className="state-icon">🚫</div>
        <div className="state-title">Access Denied</div>
        <div className="state-desc">Your account does not have the admin role.</div>
      </div>
    );
  }

  return <>{children}</>;
}

const DEV_BYPASS = import.meta.env.VITE_BYPASS_AUTH === 'true';

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/apis" element={<ApiList />} />
        <Route path="/apis/:id" element={<ApiDetail />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/users" element={<Users />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  if (DEV_BYPASS) {
    return (
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <UnauthenticatedTemplate>
        <LoginPage />
      </UnauthenticatedTemplate>

      <AuthenticatedTemplate>
        <AdminGuard>
          <AppRoutes />
        </AdminGuard>
      </AuthenticatedTemplate>
    </BrowserRouter>
  );
}
