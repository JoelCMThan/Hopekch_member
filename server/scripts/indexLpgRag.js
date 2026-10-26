require('dotenv').config();
const { indexLpgSchema } = require('../src/services/rag/lpg/lpgIndexer');
const { closeDriver } = require('../src/services/rag/lpg/neo4jClient');
const { pool } = require('../src/config/db');

(async () => {
  try {
    console.log('Starting LPG RAG indexing...');
    console.log(await indexLpgSchema());
  } catch (error) {
    console.error('LPG RAG indexing failed:', error);
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([closeDriver(), pool.end()]);
  }
})();
