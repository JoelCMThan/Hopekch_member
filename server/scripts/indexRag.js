require('dotenv').config();

const {
  indexStructuredSchema
} = require('../src/services/rag/structured/indexer');
const { pool } = require('../src/config/db');

/**
 * Run the Structured RAG indexing process.
 */
const run = async () => {
  try {
    console.log('\nStarting Structured RAG indexing...\n');

    const result = await indexStructuredSchema();

    console.log('\nStructured RAG indexing completed successfully!');
    console.log(result);

    process.exitCode = 0;
  } catch (error) {
    console.error('\nRAG indexing failed:');
    console.error(error);

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
