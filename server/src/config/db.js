const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`MySQL connected to ${process.env.DB_NAME}`);
    connection.release();
  } catch (error) {
    const details = [
      error.code,
      error.errno ? `errno ${error.errno}` : null,
      error.sqlState ? `sqlState ${error.sqlState}` : null,
      error.message,
    ].filter(Boolean).join(' | ');

    console.error('MySQL connection failed:', details || error);
    process.exit(1);
  }
};

module.exports = { pool, testConnection };
