import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('owner')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const authApi = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  sendOtp: (data) => api.post('/auth/send-otp', data),
  updateEmail: (data) => api.patch('/auth/email', data),
  updatePhone: (data) => api.patch('/auth/phone', data),
  updatePassword: (data) => api.patch('/auth/password', data),
}

// Menu
export const menuApi = {
  list: () => api.get('/menu/'),
  create: (data) => api.post('/menu/', data),
  update: (id, data) => api.put(`/menu/${id}`, data),
  delete: (id) => api.delete(`/menu/${id}`),
  seed: () => api.post('/menu/seed'),
}

// Orders
export const ordersApi = {
  list: (params) => api.get('/orders/', { params }),
  get: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  cancel: (id) => api.delete(`/orders/${id}`),
}

// Knowledge base
export const knowledgeApi = {
  upload: (formData) =>
    api.post('/knowledge/upload', formData, {
      headers: { 'Content-Type': undefined },  // Let axios set multipart boundary automatically
      timeout: 60000,
    }),
  listDocuments: () => api.get('/knowledge/documents'),
  deleteDocument: (id) => api.delete(`/knowledge/documents/${id}`),
  search: (query) => api.get('/knowledge/search', { params: { query } }),
  syncMenu: () => api.post('/knowledge/sync-menu'),
}

// Dashboard
export const dashboardApi = {
  stats:  () => api.get('/dashboard/stats'),
  calls:  (days) => api.get('/dashboard/calls', { params: { days } }),
  report: (period) => api.get('/dashboard/report', { params: { period } }),
}

// Restaurant
export const restaurantApi = {
  get: () => api.get('/restaurant/'),
  update: (data) => api.put('/restaurant/', data),
}

// Subscription
export const subscriptionApi = {
  getPlans: () => api.get('/subscription/plans'),
  getCurrent: () => api.get('/subscription/current'),
  changePlan: (plan) => api.post('/subscription/change-plan', { plan }),
  createCheckout: (plan, otp_code) => api.post('/subscription/create-checkout', { plan, otp_code }),
  createPortal: () => api.post('/subscription/create-portal'),
  cancel: () => api.post('/subscription/cancel'),
  sendPlanOtp: (plan) => api.post('/subscription/send-plan-otp', { plan }),
}

export default api
