import api from './api';

const memberService = {
  getMembers: (params = {}) => api.get('/members', { params }),
  getMember: (id) => api.get(`/members/${id}`),
  createMember: (data) => api.post('/members', data),
  updateMember: (id, data) => api.put(`/members/${id}`, data),
  deleteMember: (id) => api.delete(`/members/${id}`),
  resetPassword: (id, password) => api.patch(`/members/${id}/password`, { password }),
  getLifeGroups: (unitId, subdistrictId, options = {}) => {
    const params = { ...options };
    if (unitId) params.unitId = unitId;
    if (subdistrictId) params.subdistrictId = subdistrictId;
    return api.get('/members/life-groups', { params });
  },
  getUnits: (params = {}) => api.get('/members/units', { params }),
  getSubdistricts: (params = {}) => api.get('/members/subdistricts', { params }),
  bulkImport: (members) => api.post('/members/bulk-import', { members }),
  getBulkImportPasswordStatus: () => api.get('/members/bulk-import/password'),
  updateBulkImportPassword: (password) => api.patch('/members/bulk-import/password', { password }),
};

export default memberService;
