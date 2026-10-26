import api from './api';

const analyticsService = {
  getAnalytics: (params = {}) =>
    api.get('/analytics', { params }),

  getFilters: (unitId = '', subdistrictId = '') =>
    api.get('/analytics/filters', {
      params: { unitId: unitId || undefined, subdistrictId: subdistrictId || undefined },
    }),

  recordSundayAttendance: (payload) => api.post('/analytics/attendance', payload),
};

export default analyticsService;
