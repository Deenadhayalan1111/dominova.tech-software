const BASE_URL = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('dom_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed: ${res.status}`);
  }
  return data;
}

export const api = {
  // AUTH
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body }),

  // USERS
  getUsers: (params = {}) => request(`/users?${new URLSearchParams(params)}`),
  createUser: (body) => request('/users', { method: 'POST', body }),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PUT', body }),
  getSalespeople: () => request('/users/by-role/sales'),
  getDevelopers: () => request('/users/by-role/developers'),
  getUserById: (id) => request(`/users/${id}`),

  // LEADS
  getLeads: (params = {}) => request(`/leads?${new URLSearchParams(params)}`),
  getLeadStats: () => request('/leads/stats'),
  getLead: (id) => request(`/leads/${id}`),
  createLead: (body) => request('/leads', { method: 'POST', body }),
  updateLead: (id, body) => request(`/leads/${id}`, { method: 'PUT', body }),
  deleteLead: (id) => request(`/leads/${id}`, { method: 'DELETE' }),
  assignLead: (id, salesperson_id) => request(`/leads/${id}/assign`, { method: 'POST', body: { salesperson_id } }),
  contactLead: (id, body) => request(`/leads/${id}/contact`, { method: 'POST', body }),
  createFollowup: (id, body) => request(`/leads/${id}/followup`, { method: 'POST', body }),
  escalateLead: (id, body) => request(`/leads/${id}/escalate`, { method: 'POST', body }),
  convertLead: (id, body) => request(`/leads/${id}/convert`, { method: 'POST', body }),
  confirmProject: (id) => request(`/leads/${id}/confirm-project`, { method: 'POST' }),

  // ESCALATIONS
  getEscalations: (params = {}) => request(`/escalations?${new URLSearchParams(params)}`),
  getEscalation: (id) => request(`/escalations/${id}`),
  updateEscalation: (id, body) => request(`/escalations/${id}`, { method: 'PUT', body }),
  resolveEscalation: (id, body) => request(`/escalations/${id}`, { method: 'PUT', body }),
  convertEscalation: (id, body) => request(`/escalations/${id}/convert`, { method: 'POST', body }),

  // PROJECTS
  getProjects: (params = {}) => request(`/projects?${new URLSearchParams(params)}`),
  getProjectStats: () => request('/projects/stats'),
  getProject: (id) => request(`/projects/${id}`),
  updateProject: (id, body) => request(`/projects/${id}`, { method: 'PUT', body }),
  approveProject: (id, body) => request(`/projects/${id}/approve`, { method: 'POST', body }),
  rejectProject: (id, body) => request(`/projects/${id}/reject`, { method: 'POST', body }),
  acceptProject: (id, body) => request(`/projects/${id}/accept`, { method: 'POST', body }),
  updateProjectStatus: (id, body) => request(`/projects/${id}/status`, { method: 'PUT', body }),
  submitProject: (id, body) => request(`/projects/${id}/submit`, { method: 'POST', body }),
  finalApproveProject: (id, body) => request(`/projects/${id}/final-approve`, { method: 'POST', body }),
  finalRejectProject: (id, body) => request(`/projects/${id}/final-reject`, { method: 'POST', body }),
  sendProjectMessage: (id, message) => request(`/projects/${id}/message`, { method: 'POST', body: { message } }),

  // WALLETS
  getMyWallet: () => request('/wallets/me'),
  getWallet: (userId) => request(`/wallets/${userId}`),
  getAllWallets: () => request('/wallets'),
  creditWallet: (body) => request('/wallets/credit', { method: 'POST', body }),
  requestWithdrawal: (body) => request('/wallets/withdraw', { method: 'POST', body }),
  getMyWithdrawals: () => request('/wallets/withdrawals/my'),
  getAllWithdrawals: (params = {}) => request(`/wallets/withdrawals/all?${new URLSearchParams(params)}`),
  approveWithdrawal: (id, body = {}) => request(`/wallets/withdrawals/${id}/approve`, { method: 'POST', body }),
  rejectWithdrawal: (id, body) => request(`/wallets/withdrawals/${id}/reject`, { method: 'POST', body }),

  // NOTIFICATIONS
  getNotifications: (params = {}) => request(`/notifications?${new URLSearchParams(params)}`),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () => request('/notifications/mark-all-read', { method: 'PUT' }),
  getUnreadCount: () => request('/notifications/count'),

  // REPORTS
  getOverview: () => request('/reports/overview'),
  getFollowupsReport: (params = {}) => request(`/reports/followups?${new URLSearchParams(params)}`),
  getAuditLog: (params = {}) => request(`/reports/audit?${new URLSearchParams(params)}`),
};
