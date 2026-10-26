import api from './api';

const settingsService = {
  getLlmSettings: () => api.get('/settings/llm'),
  updateLlmModel: model => api.patch('/settings/llm', { model }),
  updateLlmApiKey: apiKey => api.patch('/settings/llm/key', { apiKey }),
};

export default settingsService;
