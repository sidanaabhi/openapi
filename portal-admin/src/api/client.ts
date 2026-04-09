import axios from 'axios';
import { msalInstance, loginRequest } from '../auth/msalConfig';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Api {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  version: string | null;
  base_path: string;
  backend_url: string;
  owner_id: string | null;
  connect_timeout_ms: number | null;
  response_timeout_ms: number | null;
  openapi_spec: object | null;
  openapi_raw: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  owner_id: string | null;
  approval_required: boolean;
  status: 'published' | 'draft' | 'archived';
  created_at: string;
  apis?: Api[];
}

export interface Subscription {
  id: string;
  developer_id: string;
  product_id: string;
  name: string;
  key_version: number;
  status: 'active' | 'suspended' | 'pending' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  developer?: { email: string; display_name: string };
  product?: { name: string; display_name: string | null };
}

export interface User {
  id: string;
  entra_object_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  roles: Array<'admin' | 'publisher' | 'developer'>;
}

// ── Axios instance ───────────────────────────────────────────────────────────

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001',
});

http.interceptors.request.use(async (config) => {
  const account = msalInstance.getActiveAccount();
  if (account) {
    try {
      const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
      config.headers.Authorization = `Bearer ${result.accessToken}`;
    } catch {
      // Silent acquire failed — redirect to login instead of sending unauthenticated request
      await msalInstance.acquireTokenRedirect({ ...loginRequest, account });
      return Promise.reject(new Error('Session expired. Redirecting to login.'));
    }
  }
  return config;
});

// ── API functions ─────────────────────────────────────────────────────────────

export const apiClient = {
  // APIs
  listApis: () => http.get<Api[]>('/api/apis').then(r => r.data),
  getApi: (id: string) => http.get<Api>(`/api/apis/${id}`).then(r => r.data),
  createApi: (data: Partial<Api>) => http.post<Api>('/api/apis', data).then(r => r.data),
  updateApi: (id: string, data: Partial<Api>) => http.put<Api>(`/api/apis/${id}`, data).then(r => r.data),
  deleteApi: (id: string) => http.delete(`/api/apis/${id}`),

  // Products
  listProducts: () => http.get<Product[]>('/api/products').then(r => r.data),
  getProduct: (id: string) => http.get<Product>(`/api/products/${id}`).then(r => r.data),
  createProduct: (data: Partial<Product>) => http.post<Product>('/api/products', data).then(r => r.data),
  updateProduct: (id: string, data: Partial<Product>) => http.put<Product>(`/api/products/${id}`, data).then(r => r.data),
  addApiToProduct: (productId: string, apiId: string) =>
    http.post(`/api/products/${productId}/apis`, { api_id: apiId }).then(r => r.data),
  removeApiFromProduct: (productId: string, apiId: string) =>
    http.delete(`/api/products/${productId}/apis/${apiId}`),

  // Subscriptions
  listSubscriptions: () => http.get<Subscription[]>('/api/subscriptions').then(r => r.data),
  approveSubscription: (id: string) => http.put(`/api/subscriptions/${id}/approve`).then(r => r.data),
  rejectSubscription: (id: string) => http.put(`/api/subscriptions/${id}/reject`).then(r => r.data),
  suspendSubscription: (id: string) =>
    http.put<Subscription>(`/api/subscriptions/${id}`, { status: 'suspended' }).then(r => r.data),

  // Users
  listUsers: () => http.get<User[]>('/api/users').then(r => r.data),
  updateUserRoles: (id: string, roles: string[]) =>
    http.put<User>(`/api/users/${id}/roles`, { roles }).then(r => r.data),

  // OpenAPI
  validateSpec: (formData: FormData) =>
    http.post('/api/openapi/validate', formData).then(r => r.data),
  importSpec: (formData: FormData) =>
    http.post<Api>('/api/openapi/import', formData).then(r => r.data),
};
