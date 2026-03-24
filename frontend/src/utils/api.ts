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

// Inject auth token and security headers
api.interceptors.request.use((config) => {
  // Add security headers
  config.headers['X-Requested-With'] = 'XMLHttpRequest';
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally (auto-logout unless on public pages)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/forgot') && !window.location.pathname.startsWith('/apply')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('organization');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth (login/register use publicApi to avoid stale token interference)
export const authApi = {
  login: (email: string, password: string) =>
    publicApi.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string, company_name?: string) =>
    publicApi.post('/auth/register', { email, password, name, company_name }),
  updateProfile: (name: string, company_name?: string) =>
    api.put('/auth/profile', { name, company_name }),
  verify: (code: string) =>
    api.post('/auth/verify', { code }),
  resendCode: () =>
    api.post('/auth/resend-code'),
  googleLogin: (credential: string) =>
    publicApi.post('/auth/google', { credential }),
  linkedinLogin: (code: string, redirectUri: string) =>
    publicApi.post('/auth/linkedin', { code, redirect_uri: redirectUri }),
  forgotPassword: (email: string) =>
    publicApi.post('/auth/forgot-password', { email }),
  resetPassword: (email: string, code: string, new_password: string) =>
    publicApi.post('/auth/reset-password', { email, code, new_password }),
  setup2FA: () =>
    api.post('/auth/2fa/setup'),
  verify2FA: (code: string) =>
    api.post('/auth/2fa/verify', { code }),
  disable2FA: () =>
    api.post('/auth/2fa/disable'),
};

// Vacancies
export const vacanciesApi = {
  list: () => api.get('/vacancies'),
  get: (id: string) => api.get(`/vacancies/${id}`),
  create: (data: unknown) => api.post('/vacancies', data),
  update: (id: string, data: unknown) => api.put(`/vacancies/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/vacancies/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/vacancies/${id}`),
  generateForm: (id: string) => api.post(`/vacancies/${id}/generate-form`),
  syncResponses: (id: string) => api.post(`/vacancies/${id}/sync-responses`),
  publishToHH: (id: string, hhToken: string) => api.post(`/vacancies/${id}/publish-hh`, { hh_token: hhToken }),
  postToTelegram: (id: string, channelId: string) =>
    api.post(`/vacancies/${id}/post-telegram`, { channel_id: channelId }),
  bulkUpload: (vacancyId: string, files: FileList | File[]) => {
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('resumes', f));
    return api.post(`/vacancies/${vacancyId}/bulk-upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 min for large uploads
    });
  },
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
  compareMulti: (ids: string[]) =>
    api.post('/candidates/compare', { candidate_ids: ids }),
  listAll: (params?: Record<string, unknown>) =>
    api.get('/candidates', { params }),
  generateInterviewQuestions: (id: string) =>
    api.post(`/candidates/${id}/interview-questions`),
  downloadReport: (id: string) => api.get(`/candidates/${id}/report`, { responseType: 'blob' }),
  exportCsv: (vacancyId: string) =>
    api.get(`/candidates/vacancy/${vacancyId}/export`, { responseType: 'blob' }),
  exportExcel: (vacancyId: string) =>
    api.get(`/candidates/vacancy/${vacancyId}/export-excel`, { responseType: 'blob' }),
  exportBatchPdf: (vacancyId: string) =>
    api.get(`/candidates/vacancy/${vacancyId}/report-pdf`, { responseType: 'blob' }),
  exportAudit: (vacancyId: string) =>
    api.get(`/candidates/vacancy/${vacancyId}/export-audit`, { responseType: 'blob' }),
  uploadResume: (id: string, file: File) => {
    const form = new FormData();
    form.append('resume', file);
    return api.post(`/candidates/${id}/upload-resume`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getRules: () => api.get("/candidates/rules/list"),
  createRule: (data: { vacancy_id?: string; condition_type: string; condition_value?: number; action_type: string }) =>
    api.post("/candidates/rules", data),
  deleteRule: (id: string) => api.delete(`/candidates/rules/${id}`),
  sendEmail: (id: string, data: { template: string; interview_date?: string; interview_link?: string; salary?: string; start_date?: string }) =>
    api.post(`/candidates/${id}/send-email`, data),
};

// Analytics
export const analyticsApi = {
  overview: () => api.get('/analytics/overview'),
  vacancy: (id: string) => api.get(`/analytics/vacancy/${id}`),
  funnel: () => api.get('/analytics/funnel'),
};

// Organizations
export const orgsApi = {
  getMe: () => api.get('/organizations/me'),
  updateMe: (name: string) => api.put('/organizations/me', { name }),
  getMembers: () => api.get('/organizations/me/members'),
  invite: (email: string) => api.post('/organizations/me/invite', { email }),
  updateBranding: (data: { logo_url?: string; primary_color?: string; company_domain?: string; custom_email_footer?: string }) =>
    api.put('/organizations/branding', data),
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
  getUsage: () => api.get('/admin/usage'),
};

// Support
export const supportApi = {
  create: (data: { category: string; subject: string; message: string; priority?: string }) =>
    api.post('/support', data),
  getMyTickets: () => api.get('/support/my'),
  // Admin
  getAllTickets: () => api.get('/support/all'),
  getStats: () => api.get('/support/stats'),
  reply: (id: string, reply: string, status?: string) =>
    api.put(`/support/${id}/reply`, { reply, status }),
  updateStatus: (id: string, status: string) =>
    api.patch(`/support/${id}/status`, { status }),
};

// Tokens
export const tokensApi = {
  getBalance: () => api.get('/tokens/balance'),
  getPlans: () => api.get('/tokens/plans'),
  getHistory: () => api.get('/tokens/history'),
  useTokens: (action: string, description?: string) =>
    api.post('/tokens/use', { action, description }),
  getCustomPrice: (amount: number) =>
    api.post('/tokens/custom-price', { amount }),
  // Admin
  getAdminStats: () => api.get('/tokens/admin/stats'),
  giveBonus: (userId: string, amount: number, reason?: string) =>
    api.post('/tokens/admin/bonus', { user_id: userId, amount, reason }),
  getWhitelist: () => api.get('/tokens/admin/whitelist'),
  addToWhitelist: (email: string, note?: string) =>
    api.post('/tokens/admin/whitelist', { email, note }),
  removeFromWhitelist: (id: string) =>
    api.delete(`/tokens/admin/whitelist/${id}`),
};

// Notifications
export const notificationsApi = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  unreadCount: () => api.get('/notifications/unread-count'),
};

// Interviews
export const interviewsApi = {
  list: () => api.get('/interviews'),
  create: (data: Record<string, unknown>) => api.post('/interviews', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/interviews/${id}`, data),
  delete: (id: string) => api.delete(`/interviews/${id}`),
  upcoming: () => api.get('/interviews/upcoming'),
};

// Talent Pool
export const talentPoolApi = {
  list: (params?: Record<string, unknown>) => api.get('/talent-pool', { params }),
  add: (data: Record<string, unknown>) => api.post('/talent-pool', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/talent-pool/${id}`, data),
  delete: (id: string) => api.delete(`/talent-pool/${id}`),
  fromCandidate: (candidateId: string) => api.post(`/talent-pool/from-candidate/${candidateId}`),
};

// Payments
export const paymentsApi = {
  getMethods: () => api.get('/payments/methods'),
  createOrder: (planId: string, method: string) =>
    api.post('/payments/create-order', { plan_id: planId, method }),
};
