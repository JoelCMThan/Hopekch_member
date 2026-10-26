require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const EXPECTED_DATABASE = 'church_db';
const databaseDir = path.resolve(__dirname, '../../database');

const loadSql = fileName => fs.readFileSync(path.join(databaseDir, fileName), 'utf8');

const main = async () => {
  if (process.env.DB_NAME !== EXPECTED_DATABASE) {
    throw new Error(`Refusing to reset unexpected database: ${process.env.DB_NAME || '(not configured)'}`);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    await connection.query(`DROP DATABASE \`${EXPECTED_DATABASE}\``);
    await connection.query(loadSql('database_creation.txt'));
    await connection.query(loadSql('seeds.sql'));
    await connection.query(loadSql('rag_schema.sql'));

    const [[totals]] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM ${EXPECTED_DATABASE}.Member) AS members,
        (SELECT COUNT(*) FROM ${EXPECTED_DATABASE}.\`User\`) AS users,
        (SELECT COUNT(*) FROM ${EXPECTED_DATABASE}.LifeGroup) AS lifeGroups,
        (SELECT COUNT(*) FROM ${EXPECTED_DATABASE}.Leadership) AS leadership,
        (SELECT COUNT(*) FROM ${EXPECTED_DATABASE}.ServiceAttendance) AS attendance,
        (SELECT COUNT(*) FROM ${EXPECTED_DATABASE}.EmailLog) AS emailLogs
    `);

    if (totals.members !== 1000 || totals.users !== 1000 || totals.lifeGroups !== 60 || totals.leadership !== 175) {
      throw new Error(`Seed verification failed: ${JSON.stringify(totals)}`);
    }
    console.log(JSON.stringify(totals, null, 2));
  } finally {
    await connection.end();
  }
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
