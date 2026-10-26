import api from './api';

const communicationService = {
  // Communication overview
  getOverview: () =>
    api.get('/communication/overview'),

  // Recipient selection
  getRecipientOptions: () =>
    api.get('/communication/recipients/options'),

  searchRecipients: (search) =>
    api.get('/communication/recipients/search', {
      params: {
        search,
      },
    }),

  getRecipientCount: (data) =>
    api.post('/communication/recipients/count', data),

  // Drafts
  createDraft: (data) =>
    api.post('/communication/drafts', data),

  getDrafts: () =>
    api.get('/communication/drafts'),

  updateDraft: (emailId, data) =>
    api.put(`/communication/drafts/${emailId}`, data),

  discardDraft: (emailId) =>
    api.delete(`/communication/drafts/${emailId}`),

  // Sending
  sendEmail: (data) =>
    api.post('/communication/send', data),

  // Email history
  getHistory: () =>
    api.get('/communication/history'),

  getHistoryById: (emailId) =>
    api.get(`/communication/history/${emailId}`),
};

export default communicationService;