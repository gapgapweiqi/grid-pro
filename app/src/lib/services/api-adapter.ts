/**
 * API Adapter — calls the Cloudflare Worker API via fetch with JWT.
 * This is a thin network layer. Offline caching is handled by CachingAdapter (IndexedDB/Dexie).
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth.token');
}

async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<{ ok: boolean; data?: T; error?: { code: string; message: string } }> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    const json = await res.json();
    // Propagate HTTP status for callers that need to distinguish 401 vs other errors
    if (!res.ok && json && typeof json === 'object') {
      (json as any)._httpStatus = res.status;
    }
    return json as any;
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      return { ok: false, error: { code: 'TIMEOUT', message: 'เซิร์ฟเวอร์ไม่ตอบสนอง กรุณาลองใหม่อีกครั้ง' } };
    }
    return { ok: false, error: { code: 'NETWORK_ERROR', message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' } };
  }
}

// ===== Auth =====
export const authApi = {
  loginGoogle: (code: string, redirectUri: string) =>
    apiFetch('/api/auth/google', { method: 'POST', body: JSON.stringify({ code, redirectUri }) }),

  loginLine: (code: string, redirectUri: string) =>
    apiFetch('/api/auth/line', { method: 'POST', body: JSON.stringify({ code, redirectUri }) }),

  register: (email: string, password: string, name: string) =>
    apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),

  login: (email: string, password: string) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () => apiFetch('/api/auth/me'),

  updateProfile: (data: { name?: string; avatarUrl?: string }) =>
    apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch('/api/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),

  deleteAccount: () =>
    apiFetch('/api/auth/me', { method: 'DELETE' }),

  connectDrive: () =>
    apiFetch('/api/auth/me/drive', { method: 'POST' }),

  connectGoogleDrive: (code: string, redirectUri: string) =>
    apiFetch('/api/auth/google/connect', { method: 'POST', body: JSON.stringify({ code, redirectUri }) }),

  forgotPassword: (email: string) =>
    apiFetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
};

// ===== Master Data =====
export const masterApi = {
  list: (type: string, companyId: string) =>
    apiFetch(`/api/master/${type}?companyId=${companyId}`),

  upsert: (type: string, data: any) =>
    apiFetch(`/api/master/${type}`, { method: 'POST', body: JSON.stringify(data) }),

  delete: (type: string, ids: string[]) =>
    apiFetch(`/api/master/${type}`, { method: 'DELETE', body: JSON.stringify({ ids }) }),
};

// ===== Documents =====
export const docApi = {
  list: (companyId: string, docType?: string, limit = 50, offset = 0) => {
    let url = `/api/docs?companyId=${companyId}&limit=${limit}&offset=${offset}`;
    if (docType) url += `&docType=${docType}`;
    return apiFetch(url);
  },

  get: (docId: string) => apiFetch(`/api/docs/${docId}`),

  chain: (docId: string) => apiFetch(`/api/docs/${docId}/chain`),

  upsert: (data: { header: any; lines: any[] }) =>
    apiFetch('/api/docs', { method: 'POST', body: JSON.stringify(data) }),

  updateStatus: (docId: string, status: { paymentStatus?: string; docStatus?: string }) =>
    apiFetch(`/api/docs/${docId}/status`, { method: 'PATCH', body: JSON.stringify(status) }),

  delete: (ids: string[]) =>
    apiFetch('/api/docs', { method: 'DELETE', body: JSON.stringify({ ids }) }),
};

// ===== Team =====
export const teamApi = {
  list: (companyId: string) => apiFetch(`/api/team?companyId=${companyId}`),

  listAll: () => apiFetch('/api/team/all'),

  seatInfo: (companyId: string) => apiFetch(`/api/team/seat-info?companyId=${companyId}`),

  add: (data: any) =>
    apiFetch('/api/team', { method: 'POST', body: JSON.stringify(data) }),

  getInviteLink: (memberId: string) =>
    apiFetch('/api/team/invite', { method: 'POST', body: JSON.stringify({ memberId }) }),

  acceptInvite: (token: string) =>
    apiFetch('/api/team/accept', { method: 'POST', body: JSON.stringify({ token }) }),

  update: (memberId: string, data: { permissions?: string[]; status?: string; companyIds?: string[] }) =>
    apiFetch(`/api/team/${memberId}`, { method: 'PUT', body: JSON.stringify(data) }),

  remove: (memberId: string) =>
    apiFetch(`/api/team/${memberId}`, { method: 'DELETE' }),

  leaveTeam: (companyId: string) =>
    apiFetch('/api/team/leave', { method: 'POST', body: JSON.stringify({ companyId }) }),

  myMemberships: () => apiFetch('/api/team/my-memberships'),
};

// ===== Settings =====
export const settingsApi = {
  get: (scopeType = 'USER', scopeId?: string) => {
    let url = `/api/settings?scopeType=${scopeType}`;
    if (scopeId) url += `&scopeId=${scopeId}`;
    return apiFetch(url);
  },

  save: (entries: Record<string, string>, scopeType = 'USER', scopeId?: string) =>
    apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ entries, scopeType, scopeId }) }),
};

// ===== Files =====
export const fileApi = {
  upload: (file: File, companyId: string, refType = '', refId = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('companyId', companyId);
    formData.append('refType', refType);
    formData.append('refId', refId);
    return apiFetch('/api/files/upload', { method: 'POST', body: formData });
  },

  list: (companyId: string, refType?: string, refId?: string) => {
    let url = `/api/files?companyId=${companyId}`;
    if (refType) url += `&refType=${refType}`;
    if (refId) url += `&refId=${refId}`;
    return apiFetch(url);
  },
};

// ===== Email =====
export const emailApi = {
  send: (data: { to: string; cc?: string; subject: string; htmlBody?: string; pdfBase64?: string; pdfFilename?: string }) =>
    apiFetch('/api/email/send', { method: 'POST', body: JSON.stringify(data) }),
};

// ===== KPI =====
export const kpiApi = {
  get: (companyId: string) => apiFetch(`/api/kpi/${companyId}`),
};

// ===== Bootstrap =====
export const bootstrapApi = {
  user: () => apiFetch('/api/bootstrap'),
  company: (companyId: string) => apiFetch(`/api/bootstrap/${companyId}`),
};
