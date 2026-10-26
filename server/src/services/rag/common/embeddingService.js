const { GoogleGenAI } = require('@google/genai');

const config = require('../../../config/ragConfig');
const { getLlmApiKey } = require('../../../repositories/systemSettingsRepo');

const markEmbeddingRateLimit = error => {
  const details = `${error?.status || ''} ${error?.code || ''} ${error?.message || ''}`;
  if (!/429|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(details)) throw error;
  error.statusCode = 429;
  error.errorCode = 'EMBEDDING_RATE_LIMIT';
  error.retryAfterSeconds = 30;
  error.publicMessage = 'The embedding service is temporarily busy. Please try again in 30 seconds.';
  throw error;
};

const getClient = async () => {
  const apiKey = await getLlmApiKey();
  if (!apiKey) throw Object.assign(new Error('No Gemini API key is configured'), { statusCode: 503 });
  return new GoogleGenAI({ apiKey });
};

/**
 * Generate embeddings for multiple schema/document chunks.
 *
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
const embedTexts = async (texts) => {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  // Embedding 2 uses instructions inside the text instead of taskType.
  const contents = texts.map(text => ({
    parts: [
      {
        text: `task: search result | document: ${text}`
      }
    ]
  }));

  const ai = await getClient();
  let response;
  try {
    response = await ai.models.embedContent({
      model: config.embeddingModel,
      contents,
      config: {
        outputDimensionality: config.embeddingDimensions
      }
    });
  } catch (error) {
    markEmbeddingRateLimit(error);
  }

  const vectors = response.embeddings?.map(item => item.values);

  if (!vectors || vectors.length !== texts.length) {
    throw new Error('Gemini returned an unexpected number of embeddings.');
  }

  for (const vector of vectors) {
    if (
      !Array.isArray(vector) ||
      vector.length !== config.embeddingDimensions ||
      !vector.every(Number.isFinite)
    ) {
      throw new Error('Gemini returned an invalid embedding vector.');
    }
  }

  return vectors;
};

/**
 * Generate an embedding for one user question.
 *
 * @param {string} question
 * @returns {Promise<number[]>}
 */
const embedQuery = async (question) => {
  if (typeof question !== 'string' || !question.trim()) {
    throw new Error('A valid question is required.');
  }

  const ai = await getClient();
  let response;
  try {
    response = await ai.models.embedContent({
      model: config.embeddingModel,
      contents: `task: search result | query: ${question.trim()}`,
      config: {
        outputDimensionality: config.embeddingDimensions
      }
    });
  } catch (error) {
    markEmbeddingRateLimit(error);
  }

  const vector = response.embeddings?.[0]?.values;

  if (
    !Array.isArray(vector) ||
    vector.length !== config.embeddingDimensions ||
    !vector.every(Number.isFinite)
  ) {
    throw new Error('Gemini returned an invalid query embedding.');
  }

  return vector;
};

module.exports = {
  embedTexts,
  embedQuery
};
