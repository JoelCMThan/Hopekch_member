import api from './api';

const subdistrictService = {
  activate: (id) => api.patch(`/subdistricts/${id}/activate`),
  inactivate: (id) => api.patch(`/subdistricts/${id}/inactivate`),
  getSubdistricts: (params = {}) => api.get('/subdistricts', { params }),
  getSubdistrictById: (id) => api.get(`/subdistricts/${id}`),
  createSubdistrict: (data) => api.post('/subdistricts', data),
  getSplitOptions: (id) => api.get(`/subdistricts/${id}/split-options`),
  split: (id, data) => api.post(`/subdistricts/${id}/split`, data),
  updateSubdistrict: (id, data) => api.put(`/subdistricts/${id}`, data),
  deleteSubdistrict: (id) => api.delete(`/subdistricts/${id}`),
};

export default subdistrictService;
