import api from './api';

const ragService = {
  ask: async ({ question, architecture = 'structured', history = [] }) => {
    const response = await api.post('/rag/ask', { question, architecture, history });
    return response.data.data;
  },
};

export default ragService;
