const mysql = require('mysql2/promise');
const { pool } = require('../config/db');

const QUERY_TIMEOUT_MS = 5000;
const AUDIT_LOG_TIMEOUT_MS = 5000;

// Generated church-data queries use a dedicated read-only database account.
// Keeping this pool separate prevents the RAG pipeline from inheriting the
// application's write privileges.
const ragPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.RAG_DB_USER,
  password: process.env.RAG_DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 3,
});

const executeReadOnlyQuery = async (sql, maxRows) => {
  const connection = await ragPool.getConnection();
  try {
    const requestedLimit = Number(maxRows);
    const rowLimit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 1000)
      : 100;
    const limitedSql = `
      SELECT *
      FROM (${sql.replace(/;\s*$/, '')}) AS rag_result
      LIMIT ${rowLimit}
    `;
    const [rows] = await connection.query({
      sql: limitedSql,
      timeout: QUERY_TIMEOUT_MS,
    });
    return rows;
  } finally {
    connection.release();
  }
};

const createQueryLog = async ({
  memberId,
  question,
  generatedSql,
  retrievedContext,
  answer = null,
  retrievalTimeMs = null,
  generationTimeMs = null,
  executionTimeMs = null,
  totalTimeMs,
  status,
  errorMessage = null,
}) => {
  await pool.execute({
    sql: `INSERT INTO RAGQueryLog
      (MemberID, Question, GeneratedSQL, RetrievedChunks, Answer,
       RetrievalTimeMs, GenerationTimeMs, ExecutionTimeMs, TotalTimeMs,
       Status, ErrorMessage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      memberId || null,
      question,
      generatedSql,
      JSON.stringify(retrievedContext),
      answer,
      retrievalTimeMs,
      generationTimeMs,
      executionTimeMs,
      totalTimeMs,
      status,
      errorMessage,
    ],
    timeout: AUDIT_LOG_TIMEOUT_MS,
  });
};

module.exports = {
  AUDIT_LOG_TIMEOUT_MS,
  executeReadOnlyQuery,
  createQueryLog,
};
