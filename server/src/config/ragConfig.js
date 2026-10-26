
require('dotenv').config();

const chatModels = Object.freeze([
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
]);

const defaultChatModel = 'gemini-2.5-flash';

const ragConfig = {
  chatModel: process.env.RAG_CHAT_MODEL || defaultChatModel,

  chatModels,

  defaultChatModel,

  isSupportedChatModel: model => chatModels.some(option => option.value === model),

  embeddingModel:
    process.env.RAG_EMBEDDING_MODEL,

  embeddingDimensions: Number(process.env.RAG_EMBEDDING_DIMENSIONS || 1536),

  qdrantUrl:
    process.env.QDRANT_URL,

  collection:
    process.env.QDRANT_COLLECTION,

  lpgCollection:
    process.env.QDRANT_LPG_COLLECTION || 'hope_church_lpg',

  rdfCollection:
    process.env.QDRANT_RDF_COLLECTION || 'hope_church_rdf',

  topK: Number(process.env.RAG_TOP_K),

  lpgTopK: Number(process.env.RAG_LPG_TOP_K || process.env.RAG_TOP_K || 10),

  lpgMaxHops: Math.min(4, Math.max(1, Number(process.env.RAG_LPG_MAX_HOPS || 3))),

  lpgResultLimit: Math.min(100, Math.max(1, Number(process.env.RAG_LPG_RESULT_LIMIT || 50))),

  rdfTopK: Number(process.env.RAG_RDF_TOP_K || process.env.RAG_TOP_K || 10),

  rdfMaxHops: Math.min(4, Math.max(1, Number(process.env.RAG_RDF_MAX_HOPS || 3))),

  rdfResultLimit: Math.min(100, Math.max(1, Number(process.env.RAG_RDF_RESULT_LIMIT || 50))),

  maxRows: Number(process.env.RAG_MAX_ROWS),

  allowedTables: [
    'Subdistrict',
    'Unit',
    'LifeGroup',
    'Member',
    'MembershipStatus',
    'MemberPhone',
    'Address',
    'User',
    'ScopeType',
    'Leadership',
    'MembershipActive',
    'MemberEngagement',
    'Baptism',
    'ServiceAttendance',
    'EmailLog'
  ]
};

module.exports = ragConfig;
