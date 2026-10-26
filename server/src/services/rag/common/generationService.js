const { GoogleGenAI } = require('@google/genai');
const { getLlmApiKey } = require('../../../repositories/systemSettingsRepo');

const markModelRateLimit = error => {
  const details = `${error?.status || ''} ${error?.code || ''} ${error?.message || ''}`;
  if (!/429|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(details)) throw error;
  error.statusCode = 429;
  error.errorCode = 'MODEL_RATE_LIMIT';
  error.retryAfterSeconds = 30;
  error.publicMessage = 'The AI model service is temporarily busy. Please try again in 30 seconds.';
  throw error;
};

const generateText = async ({ model, temperature, response_format, messages }) => {
  const apiKey = await getLlmApiKey();
  if (!apiKey) throw Object.assign(new Error('No Gemini API key is configured'), { statusCode: 503 });
  const ai = new GoogleGenAI({ apiKey });
  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: messages.filter(message => message.role !== 'system').map(message => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }]
      })),
      config: {
        systemInstruction: messages.filter(message => message.role === 'system')
          .map(message => message.content).join('\n\n'),
        temperature,
        ...(response_format?.type === 'json_object' ? { responseMimeType: 'application/json' } : {})
      }
    });
  } catch (error) {
    markModelRateLimit(error);
  }

  if (!response.text?.trim()) {
    throw new Error('Gemini returned an empty response.');
  }
  return response.text;
};

module.exports = { generateText };
