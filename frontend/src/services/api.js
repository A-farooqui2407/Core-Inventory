import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

const AUTH_TOKEN_KEY = 'coreinventory_token';

export function getStoredToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      setStoredToken(null);
      window.dispatchEvent(new CustomEvent('auth:401'));
      const e = new Error(err.response?.data?.error?.message || 'Unauthorized');
      e.status = 401;
      return Promise.reject(e);
    }
    const message =
      err.response?.data?.error?.message ||
      err.message ||
      'Request failed';
    return Promise.reject(new Error(message));
  }
);

export const authApi = {
  status: () => api.get('/auth/status'),
  login: (username, password) => api.post('/auth/login', { username, password }),
};

export const productsApi = {
  list: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${id}`),
  create: (body) => api.post('/products', body),
  update: (id, body) => api.put(`/products/${id}`, body),
  delete: (id) => api.delete(`/products/${id}`),
};

export const warehousesApi = {
  list: (params) => api.get('/warehouses', { params }),
  get: (id) => api.get(`/warehouses/${id}`),
  create: (body) => api.post('/warehouses', body),
  update: (id, body) => api.put(`/warehouses/${id}`, body),
  delete: (id) => api.delete(`/warehouses/${id}`),
};

export const locationsApi = {
  list: (params) => api.get('/locations', { params }),
  get: (id) => api.get(`/locations/${id}`),
  create: (body) => api.post('/locations', body),
  update: (id, body) => api.put(`/locations/${id}`, body),
  delete: (id) => api.delete(`/locations/${id}`),
};

export const movementsApi = {
  list: (params) => api.get('/movements', { params }),
  get: (id) => api.get(`/movements/${id}`),
  create: (body) => api.post('/movements', body),
  delete: (id) => api.delete(`/movements/${id}`),
};

export const dashboardApi = {
  summary: (params) => api.get('/dashboard/summary', { params }),
};

export const scheduledApi = {
  list: (params) => api.get('/scheduled', { params }),
  get: (id) => api.get(`/scheduled/${id}`),
  create: (body) => api.post('/scheduled', body),
  update: (id, body) => api.put(`/scheduled/${id}`, body),
  delete: (id) => api.delete(`/scheduled/${id}`),
};
