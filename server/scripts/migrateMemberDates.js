const mysql = require('mysql2/promise');
require('dotenv').config();

const run = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await connection.query(
      'ALTER TABLE Member ADD COLUMN IF NOT EXISTS MemberSince DATE NULL AFTER JoinDate'
    );
    await connection.query(`
      UPDATE Member member
      INNER JOIN MembershipStatus status ON status.MemberID = member.MemberID
      SET member.MemberSince = COALESCE(member.MemberSince, member.JoinDate)
      WHERE status.MembershipType = 'Member'
    `);
    await connection.query(`
      GRANT SELECT (MemberSince)
      ON church_db.Member
      TO 'church_rag'@'localhost'
    `);

    const [rows] = await connection.query(`
      SELECT
        COUNT(*) AS totalMembers,
        SUM(MemberSince IS NOT NULL) AS membersWithMembershipDate
      FROM Member
    `);
    console.log(JSON.stringify(rows[0]));
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error(error.code || error.message);
  process.exitCode = 1;
});
