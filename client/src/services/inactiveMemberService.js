import api from './api';

const inactiveMemberService = {
  getInactiveMembers: (params = {}) => api.get('/inactive-members', { params }),
  searchMembersForDeactivate: (keyword) => api.get('/inactive-members/search', { params: { keyword } }),
  deactivateMember: (memberId, data) => api.post(`/inactive-members/${memberId}/deactivate`, data),
  updateInactiveDetails: (memberId, data) => api.patch(`/inactive-members/${memberId}`, data),
  activateMember: (memberId) => api.post(`/inactive-members/${memberId}/activate`),
};

export default inactiveMemberService;