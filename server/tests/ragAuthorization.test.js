const test = require('node:test');
const assert = require('node:assert/strict');

const { validateSQL } = require('../src/services/rag/structured/sqlGuard');
const { authorizeGeneratedSQL } = require('../src/services/rag/structured/ragAuthorization');
const { normalizeSemanticNameComparisons } = require('../src/services/rag/structured/semanticSql');

const scopedContext = {
  role: 'unit_leader',
  scope: 'unit',
  scopeLabel: 'Members in your unit',
  memberId: 10,
  lifeGroupId: 4,
  unitId: 7,
  subdistrictId: 2,
};

test('SQL guard permits one read-only aggregate and reports its tables', () => {
  const result = validateSQL('SELECT COUNT(*) AS total FROM Member m');
  assert.equal(result.sql, 'SELECT COUNT(*) AS total FROM Member m');
  assert.deepEqual(result.tables, ['Member']);
});

test('SQL guard rejects writes, secrets, wildcards, and multiple statements', () => {
  assert.throws(() => validateSQL('DELETE FROM Member'), /Only SELECT/);
  assert.throws(() => validateSQL('SELECT PasswordHash FROM `User`'), /Sensitive/);
  assert.throws(() => validateSQL('SELECT * FROM Member'), /SELECT \*/);
  assert.throws(() => validateSQL('SELECT MemberID FROM Member; SELECT UserID FROM `User`'), /Multiple/);
});

test('SQL guard rejects invented qualified columns before database execution', () => {
  assert.throws(
    () => validateSQL("SELECT m.FirstName FROM Member m WHERE m.Role != 'master_admin'"),
    /Column m\.Role does not exist/
  );
});

test('semantic name normalization removes stored spaces before full-name matching', () => {
  const sql = normalizeSemanticNameComparisons(
    "SELECT m.FirstName FROM Member m WHERE LOWER(CONCAT(m.FirstName, ' ', m.LastName)) LIKE '%jennywong%'"
  );

  assert.match(sql, /REPLACE\(REPLACE\(LOWER\(CONCAT\(m\.FirstName, ' ', m\.LastName\)\), ' ', ''\), '-', ''\) LIKE '%jennywong%'/);
  assert.doesNotThrow(() => validateSQL(sql));
});

test('post-generation authorization injects the authenticated unit scope', () => {
  const guarded = validateSQL('SELECT COUNT(*) AS total FROM Member m');
  const sql = authorizeGeneratedSQL(guarded.sql, scopedContext, guarded.tables);
  assert.match(sql, /`m`\.`LifeGroupID` IN/);
  assert.match(sql, /`UnitID` = 7/);
  assert.match(sql, /`systemUser`\.`Role` = 'master_admin'/);
});

test('global roles still exclude the master-admin system account from members', () => {
  const guarded = validateSQL('SELECT COUNT(*) AS total FROM Member m');
  const sql = authorizeGeneratedSQL(guarded.sql, {
    role: 'master_admin',
    scope: 'all',
    scopeLabel: 'All members in the system',
    memberId: 1,
  }, guarded.tables);

  assert.match(sql, /NOT EXISTS/);
  assert.match(sql, /`systemUser`\.`Role` = 'master_admin'/);
});

test('global roles authorize attendance trend queries containing MySQL intervals', () => {
  const guarded = validateSQL(
    'SELECT ServiceDate AS ServiceDate, SUM(AttendanceCount) AS TotalAttendance FROM serviceattendance WHERE ServiceDate >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY ServiceDate ORDER BY ServiceDate ASC;'
  );
  const sql = authorizeGeneratedSQL(guarded.sql, {
    role: 'master_admin',
    scope: 'all',
    scopeLabel: 'All members in the system',
    memberId: 1,
  }, guarded.tables);

  assert.equal(sql, guarded.sql);
});

test('post-generation authorization rejects a query that cannot be safely scoped', () => {
  const guarded = validateSQL('SELECT COUNT(*) AS total FROM MembershipStatus ms');
  assert.throws(
    () => authorizeGeneratedSQL(guarded.sql, scopedContext, guarded.tables),
    /current role cannot access.*cannot be safely limited/
  );
});

test('scoped roles cannot query communication logs', () => {
  const guarded = validateSQL('SELECT COUNT(*) AS total FROM EmailLog e JOIN `User` usr ON usr.UserID = e.SenderUserID JOIN Member m ON m.MemberID = usr.MemberID');
  assert.throws(
    () => authorizeGeneratedSQL(guarded.sql, scopedContext, guarded.tables),
    /current role does not have permission/
  );
});
