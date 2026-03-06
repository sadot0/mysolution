import axios from 'axios';

// In dev: Vite proxy handles /api → localhost:3001 (BASE is empty)
// In production: Express serves both frontend and /api from same origin (BASE is empty)
// Set VITE_API_URL only if backend is on a different domain
const BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Public API (no auth) — used by ApplyPage, etc.
export const publicApi = axios.create({
  baseURL: `${BASE}/api`,
});

// Inject auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string, company_name?: string) =>
    api.post('/auth/register', { email, password, name, company_name }),
  updateProfile: (name: string, company_name?: string) =>
    api.put('/auth/profile', { name, company_name }),
  verify: (code: string) =>
    api.post('/auth/verify', { code }),
  resendCode: () =>
    api.post('/auth/resend-code'),
};

// Vacancies
export const vacanciesApi = {
  list: () => api.get('/vacancies'),
  get: (id: string) => api.get(`/vacancies/${id}`),
  create: (data: unknown) => api.post('/vacancies', data),
  update: (id: string, data: unknown) => api.put(`/vacancies/${id}`, data),
  delete: (id: string) => api.delete(`/vacancies/${id}`),
  generateForm: (id: string) => api.post(`/vacancies/${id}/generate-form`),
  syncResponses: (id: string) => api.post(`/vacancies/${id}/sync-responses`),
};

// Candidates
export const candidatesApi = {
  listByVacancy: (vacancyId: string, params?: Record<string, unknown>) =>
    api.get(`/candidates/vacancy/${vacancyId}`, { params }),
  get: (id: string) => api.get(`/candidates/${id}`),
  create: (data: unknown) => api.post('/candidates', data),
  analyze: (id: string) => api.post(`/candidates/${id}/analyze`),
  batchAnalyze: (vacancyId: string) =>
    api.post(`/candidates/vacancy/${vacancyId}/batch-analyze`),
  updateStatus: (id: string, status: string) =>
    api.put(`/candidates/${id}/status`, { status }),
  compare: (id1: string, id2: string) =>
    api.get(`/candidates/${id1}/compare/${id2}`),
  listAll: (params?: Record<string, unknown>) =>
    api.get('/candidates', { params }),
  generateInterviewQuestions: (id: string) =>
    api.post(`/candidates/${id}/interview-questions`),
  exportCsv: (vacancyId: string) =>
    api.get(`/candidates/vacancy/${vacancyId}/export`, { responseType: 'blob' }),
  uploadResume: (id: string, file: File) => {
    const form = new FormData();
    form.append('resume', file);
    return api.post(`/candidates/${id}/upload-resume`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Analytics
export const analyticsApi = {
  overview: () => api.get('/analytics/overview'),
  vacancy: (id: string) => api.get(`/analytics/vacancy/${id}`),
};

// Organizations
export const orgsApi = {
  getMe: () => api.get('/organizations/me'),
  updateMe: (name: string) => api.put('/organizations/me', { name }),
  getMembers: () => api.get('/organizations/me/members'),
  invite: (email: string) => api.post('/organizations/me/invite', { email }),
};

// Admin
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getOrgs: (page = 1, limit = 20) => api.get('/admin/organizations', { params: { page, limit } }),
  getUsers: (page = 1, limit = 20) => api.get('/admin/users', { params: { page, limit } }),
  updateOrgPlan: (id: string, plan: 'free' | 'pro') =>
    api.put(`/admin/organizations/${id}/plan`, { plan }),
  updateUserRole: (id: string, role: 'user' | 'superadmin') =>
    api.put(`/admin/users/${id}/role`, { role }),
};
