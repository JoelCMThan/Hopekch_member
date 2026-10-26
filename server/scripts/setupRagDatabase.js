const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');

const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath, quiet: true });
const config = require('../src/config/ragConfig');

const run = async () => {
  const connectionOptions = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
  };
  const admin = await mysql.createConnection({
    ...connectionOptions,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    const username = process.argv.includes('--new-account')
      ? 'church_rag_reader'
      : 'church_rag';
    const resumeCreatedAccount = process.argv.includes('--resume-created-account');

    const password = crypto.randomBytes(32).toString('hex');
    const account = `${mysql.escape(username)}@${mysql.escape('localhost')}`;
    const [columns] = await admin.query(
      'SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()'
    );
    const grants = new Map();
    const allowedTables = new Set(config.allowedTables.map(table => table.toLowerCase()));
    for (const column of columns) {
      if (!allowedTables.has(column.TABLE_NAME.toLowerCase())) continue;
      if (/password|passwd|secret|token|hash/i.test(column.COLUMN_NAME)) continue;
      const names = grants.get(column.TABLE_NAME) || [];
      names.push(mysql.escapeId(column.COLUMN_NAME));
      grants.set(column.TABLE_NAME, names);
    }
    if (!grants.size) throw new Error('No approved church tables were found.');

    await admin.query(`${resumeCreatedAccount ? 'ALTER' : 'CREATE'} USER ${account} IDENTIFIED BY ${mysql.escape(password)}`);
    let env = fs.readFileSync(envPath, 'utf8');
    for (const [key, value] of Object.entries({ RAG_DB_USER: username, RAG_DB_PASSWORD: password })) {
      const pattern = new RegExp(`^${key}=.*$`, 'm');
      env = pattern.test(env) ? env.replace(pattern, `${key}=${value}`) : `${env.trimEnd()}\n${key}=${value}\n`;
    }
    fs.writeFileSync(envPath, env);
    for (const [table, names] of grants) {
      await admin.query(`GRANT SELECT (${names.join(', ')}) ON ${mysql.escapeId(process.env.DB_NAME)}.${mysql.escapeId(table)} TO ${account}`);
      console.log(`Read access granted: ${table}`);
    }

    const reader = await mysql.createConnection({ ...connectionOptions, user: username, password });
    try {
      await reader.query('SELECT COUNT(*) FROM Member');
      const [readerGrants] = await reader.query('SHOW GRANTS FOR CURRENT_USER');
      for (const row of readerGrants) {
        const grant = Object.values(row)[0];
        if (!/^GRANT (USAGE|SELECT)\b/.test(grant)) {
          throw new Error('Unexpected privileges on the RAG account.');
        }
      }
      try {
        await reader.query('DELETE FROM Member WHERE 1 = 0');
        throw new Error('The RAG account unexpectedly has write access.');
      } catch (error) {
        if (error.code !== 'ER_TABLEACCESS_DENIED_ERROR') throw error;
      }
    } finally {
      await reader.end();
    }

    const schema = fs.readFileSync(path.resolve(__dirname, '../../database/rag_schema.sql'), 'utf8');
    for (const statement of schema.split(';').filter(value => value.trim())) {
      await admin.query(statement);
    }

    console.log(`Configured a read-only RAG account for ${grants.size} tables; sensitive columns excluded.`);
    console.log('Verified SELECT works and DELETE is denied. RAG log tables are ready.');
    console.log('Credentials saved to server/.env. Restart the backend to load them.');
  } finally {
    await admin.end();
  }
};

run().catch(error => {
  console.error('RAG database setup failed:', error.code || error.message);
  if (error.code === 'ER_GET_ERRNO') console.error(error.sqlMessage);
  process.exitCode = 1;
});
