const axios = require('axios');

const settings = () => {
  const baseUrl = (process.env.FUSEKI_URL || '').replace(/\/$/, '');
  const dataset = process.env.FUSEKI_DATASET || 'hope';
  if (!baseUrl) {
    const error = new Error('RDF RAG is not configured. Set FUSEKI_URL and FUSEKI_DATASET.');
    error.statusCode = 503;
    error.publicMessage = error.message;
    throw error;
  }
  const auth = process.env.FUSEKI_USERNAME && process.env.FUSEKI_PASSWORD
    ? { username: process.env.FUSEKI_USERNAME, password: process.env.FUSEKI_PASSWORD } : undefined;
  return { baseUrl, dataset, auth };
};

const replaceGraph = async (graphUri, ntriples) => {
  const { baseUrl, dataset, auth } = settings();
  await axios.put(`${baseUrl}/${encodeURIComponent(dataset)}/data`, ntriples, {
    params: { graph: graphUri }, auth,
    headers: { 'Content-Type': 'application/n-triples' }, timeout: 30000
  });
};

const select = async query => {
  const { baseUrl, dataset, auth } = settings();
  const body = new URLSearchParams({ query }).toString();
  const response = await axios.post(`${baseUrl}/${encodeURIComponent(dataset)}/query`, body, {
    auth, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
    timeout: 10000
  });
  return response.data?.results?.bindings || [];
};

module.exports = { replaceGraph, select };
