import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const inventoryApi = {
  // Inventory items
  list: (lowStockOnly = false) =>
    api.get(`/inventory${lowStockOnly ? '?low_stock_only=true' : ''}`),

  upload: (items) =>
    api.post('/inventory/upload', items),

  update: (id, data) =>
    api.put(`/inventory/${id}`, data),

  remove: (id) =>
    api.delete(`/inventory/${id}`),

  // Ingredient mappings
  getMappings: (menuItemId) =>
    api.get(`/inventory/map/${menuItemId}`),

  saveMappings: (data) =>
    api.post('/inventory/map', data),

  // Waste
  logWaste: (data) =>
    api.post('/inventory/waste', data),

  // Analytics & recommendations
  getAnalytics: (days = 7) =>
    api.get(`/inventory/analytics?days=${days}`),

  getRecommendations: () =>
    api.get('/inventory/recommendations'),

  getLogs: ({ itemId, type, limit = 100 } = {}) => {
    const params = new URLSearchParams()
    if (itemId) params.append('item_id', itemId)
    if (type) params.append('change_type', type)
    params.append('limit', limit)
    return api.get(`/inventory/logs?${params.toString()}`)
  },

  extractInvoice: (formData) =>
    api.post('/inventory/invoice/extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}
