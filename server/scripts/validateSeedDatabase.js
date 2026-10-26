require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const VALIDATION_DATABASE = 'church_seed_validation';
const databaseDir = path.resolve(__dirname, '../../database');

const loadSql = fileName => fs.readFileSync(path.join(databaseDir, fileName), 'utf8')
  .replaceAll('church_db', VALIDATION_DATABASE);

const main = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${VALIDATION_DATABASE}\``);
    await connection.query(loadSql('database_creation.txt'));
    await connection.query(loadSql('seeds.sql'));
    await connection.query(loadSql('rag_schema.sql'));

    const [[totals]] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM ${VALIDATION_DATABASE}.Member) AS members,
        (SELECT COUNT(*) FROM ${VALIDATION_DATABASE}.\`User\`) AS users,
        (SELECT COUNT(*) FROM ${VALIDATION_DATABASE}.LifeGroup) AS lifeGroups,
        (SELECT COUNT(*) FROM ${VALIDATION_DATABASE}.Leadership) AS leadership,
        (SELECT COUNT(*) FROM ${VALIDATION_DATABASE}.ServiceAttendance) AS attendance,
        (SELECT COUNT(*) FROM ${VALIDATION_DATABASE}.EmailLog) AS emailLogs
    `);
    const [roles] = await connection.query(
      `SELECT Role, COUNT(*) Total FROM ${VALIDATION_DATABASE}.\`User\` GROUP BY Role ORDER BY Role`
    );
    const [membershipTypes] = await connection.query(
      `SELECT MembershipType, COUNT(*) Total FROM ${VALIDATION_DATABASE}.MembershipStatus GROUP BY MembershipType ORDER BY MembershipType`
    );
    const [leadershipTypes] = await connection.query(`
      SELECT st.ScopeName, l.LeadershipType, COUNT(*) Total
      FROM ${VALIDATION_DATABASE}.Leadership l
      INNER JOIN ${VALIDATION_DATABASE}.ScopeType st ON st.ScopeTypeID = l.ScopeTypeID
      GROUP BY st.ScopeName, l.LeadershipType
      ORDER BY st.ScopeName, l.LeadershipType
    `);

    const assistantSubdistricts = leadershipTypes.find(row =>
      row.ScopeName === 'Subdistrict' && row.LeadershipType === 'Assistant Leader'
    );
    if (totals.members !== 1000 || totals.users !== 1000 || roles.length !== 10 || membershipTypes.length !== 3 || assistantSubdistricts) {
      throw new Error(`Unexpected seed totals: ${JSON.stringify({ totals, roles, membershipTypes, leadershipTypes })}`);
    }

    console.log(JSON.stringify({ totals, roles, membershipTypes, leadershipTypes }, null, 2));
  } finally {
    await connection.query(`DROP DATABASE IF EXISTS \`${VALIDATION_DATABASE}\``);
    await connection.end();
  }
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
