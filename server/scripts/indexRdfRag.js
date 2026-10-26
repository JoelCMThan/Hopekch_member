require('dotenv').config();
const { indexRdfSchema } = require('../src/services/rag/rdf/rdfIndexer');
const { pool } = require('../src/config/db');

(async () => {
  try {
    console.log('Starting RDF RAG indexing...');
    console.log(await indexRdfSchema());
  } catch (error) {
    console.error('RDF RAG indexing failed:', error.message);
    if (error.response?.status) {
      console.error(`Fuseki HTTP status: ${error.response.status}`);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
