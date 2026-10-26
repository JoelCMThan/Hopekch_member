require('dotenv').config();

const { pool } = require('../src/config/db');

const main = async () => {
  const [result] = await pool.execute(`
    UPDATE Member
    SET Email = CASE
      WHEN Email = 'master.admin@hopechurch.test' THEN 'master.admin@hopechurch.org'
      ELSE REPLACE(Email, '@hopechurch.test', '@seed.hopechurch.org')
    END
    WHERE Email LIKE '%@hopechurch.test'
  `);
  const [[masterAdmin]] = await pool.execute(`
    SELECT m.Email, u.Role
    FROM Member m
    INNER JOIN \`User\` u ON u.MemberID = m.MemberID
    WHERE u.Role = 'master_admin'
    LIMIT 1
  `);
  console.log(JSON.stringify({ updated: result.affectedRows, masterAdmin }));
};

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
