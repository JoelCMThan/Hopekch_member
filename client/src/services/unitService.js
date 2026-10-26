import api from './api';

const unitService = {
  activate: (id) => api.patch(`/units/${id}/activate`),
  inactivate: (id) => api.patch(`/units/${id}/inactivate`),
  getUnits: (params = {}) => api.get('/units', { params }),
  getUnit: (id) => api.get(`/units/${id}`),
  createUnit: (data) => api.post('/units', data),
  getSplitOptions: (id) => api.get(`/units/${id}/split-options`),
  split: (id, data) => api.post(`/units/${id}/split`, data),
  updateUnit: (id, data) => api.put(`/units/${id}`, data),
  deleteUnit: (id) => api.delete(`/units/${id}`),

  // Lookup
  getSubdistricts: () => api.get('/units/lookup/subdistricts'),
};

export default unitService;
