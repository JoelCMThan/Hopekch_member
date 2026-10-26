/* Fetches dashboard statistics scoped to the requesting user's role. */

const { pool } = require('../config/db');
const { ROLES, buildScopeClause, buildChurchMemberClause } = require('../utils/permissions');

/**
 * Builds the base FROM + JOIN + WHERE fragment shared by all stat queries,
 * scoped to the requesting user.
 */
const buildBase = (user) => {
  const scope = buildScopeClause(user);
  return {
    joins: `
      FROM Member m
      LEFT JOIN MembershipActive ma ON ma.MemberID = m.MemberID
      LEFT JOIN MembershipStatus ms ON ms.MemberID = m.MemberID
      LEFT JOIN LifeGroup lg  ON lg.LifeGroupID = m.LifeGroupID
      LEFT JOIN Unit ut       ON ut.UnitID = lg.UnitID
      LEFT JOIN Subdistrict sd ON sd.SubdistrictID = ut.SubdistrictID
      LEFT JOIN \`User\` usr   ON usr.MemberID = m.MemberID
      WHERE ${buildChurchMemberClause('m')} ${scope.clause}
    `,
    params: scope.params,
  };
};

/* ── summary counts ───────────────────────────────────────── */

const getSummaryCounts = async (user) => {
  const { joins, params } = buildBase(user);

  const sql = `
    SELECT
      COUNT(*)                                                       AS totalMembers,
      SUM(CASE WHEN COALESCE(ma.IsActive, 1) = 1 THEN 1 ELSE 0 END) AS activeMembers,
      SUM(CASE WHEN ma.IsActive = 0 THEN 1 ELSE 0 END)              AS inactiveMembers,
      SUM(CASE WHEN m.MemberSince >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END)  AS newMembers
    ${joins}
  `;

  const [rows] = await pool.execute(sql, params);
  return rows[0] ?? { totalMembers: 0, activeMembers: 0, inactiveMembers: 0, newMembers: 0 };
};

/* ── gender distribution ──────────────────────────────────── */

const getGenderDistribution = async (user) => {
  const { joins, params } = buildBase(user);

  const sql = `
    SELECT m.Gender, COUNT(*) AS count
    ${joins}
    GROUP BY m.Gender
  `;

  const [rows] = await pool.execute(sql, params);
  return rows;
};

/* ── age distribution ─────────────────────────────────────── */

const getAgeDistribution = async (user) => {
  const { joins, params } = buildBase(user);

  const sql = `
    SELECT
      CASE
        WHEN TIMESTAMPDIFF(YEAR, m.BirthDate, CURDATE()) < 19  THEN '0-18'
        WHEN TIMESTAMPDIFF(YEAR, m.BirthDate, CURDATE()) < 30  THEN '19-29'
        WHEN TIMESTAMPDIFF(YEAR, m.BirthDate, CURDATE()) < 40  THEN '30-39'
        WHEN TIMESTAMPDIFF(YEAR, m.BirthDate, CURDATE()) < 50  THEN '40-49'
        WHEN TIMESTAMPDIFF(YEAR, m.BirthDate, CURDATE()) < 60  THEN '50-59'
        ELSE '60+'
      END AS bracket,
      COUNT(*) AS count
    ${joins}
    AND m.BirthDate IS NOT NULL
    GROUP BY bracket
    ORDER BY FIELD(bracket, '0-18','19-29','30-39','40-49','50-59','60+')
  `;

  const [rows] = await pool.execute(sql, params);
  return rows;
};

/* ── membership composition ───────────────────────────────── */

const getMembershipComposition = async (user) => {
  const { joins, params } = buildBase(user);

  const sql = `
    SELECT COALESCE(ms.MembershipType, 'Member') AS type, COUNT(*) AS count
    ${joins}
    GROUP BY COALESCE(ms.MembershipType, 'Member')
  `;

  const [rows] = await pool.execute(sql, params);
  return rows;
};

/* ── scoped group / unit / subdistrict counts ─────────────── */

const getStructureCounts = async (user) => {
  const { role } = user;
  const result = { totalGroups: null, totalUnits: null, totalSubdistricts: null };

  if ([ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER].includes(role)) {
    const [[g]] = await pool.execute('SELECT COUNT(*) AS c FROM LifeGroup');
    const [[u]] = await pool.execute('SELECT COUNT(*) AS c FROM Unit');
    const [[s]] = await pool.execute('SELECT COUNT(*) AS c FROM Subdistrict');
    result.totalGroups       = g.c;
    result.totalUnits        = u.c;
    result.totalSubdistricts = s.c;
    return result;
  }

  if (role === ROLES.SUBDISTRICT_LEADER) {
    const [[u]] = await pool.execute(`
      SELECT COUNT(DISTINCT ut.UnitID) AS c
      FROM Unit ut
      INNER JOIN LifeGroup lg  ON lg.UnitID = ut.UnitID
      INNER JOIN Member m      ON m.LifeGroupID = lg.LifeGroupID
      INNER JOIN \`User\` usr  ON usr.MemberID = m.MemberID
      WHERE ut.SubdistrictID IN (
        SELECT leadership.ScopeID
        FROM Leadership leadership
        INNER JOIN ScopeType scopeType ON scopeType.ScopeTypeID = leadership.ScopeTypeID
        WHERE leadership.MemberID = ?
          AND leadership.IsActiveLeader = TRUE
          AND scopeType.ScopeName = 'Subdistrict'
      )
    `, [user.memberId]);

    const [[g]] = await pool.execute(`
      SELECT COUNT(DISTINCT lg.LifeGroupID) AS c
      FROM LifeGroup lg
      INNER JOIN Unit ut ON ut.UnitID = lg.UnitID
      WHERE ut.SubdistrictID IN (
        SELECT leadership.ScopeID
        FROM Leadership leadership
        INNER JOIN ScopeType scopeType ON scopeType.ScopeTypeID = leadership.ScopeTypeID
        WHERE leadership.MemberID = ?
          AND leadership.IsActiveLeader = TRUE
          AND scopeType.ScopeName = 'Subdistrict'
      )
    `, [user.memberId]);

    result.totalUnits  = u.c;
    result.totalGroups = g.c;
    return result;
  }

  if (role === ROLES.UNIT_LEADER || role === ROLES.ASSISTANT_UNIT_LEADER) {
    const [[g]] = await pool.execute(`
      SELECT COUNT(*) AS c FROM LifeGroup lg
      WHERE lg.UnitID = (
        SELECT lg2.UnitID FROM LifeGroup lg2
        INNER JOIN Member m2 ON m2.LifeGroupID = lg2.LifeGroupID
        INNER JOIN \`User\` u2 ON u2.MemberID = m2.MemberID
        WHERE u2.MemberID = ? LIMIT 1
      )
    `, [user.memberId]);

    result.totalGroups = g.c;
    return result;
  }

  return result;
};

/* ── members by subdistrict (admin/manager) ───────────────── */

const getMembersBySubdistrict = async () => {
  const sql = `
    SELECT sd.SubdistrictName AS name, COUNT(m.MemberID) AS count
    FROM Member m
    LEFT JOIN LifeGroup lg  ON lg.LifeGroupID = m.LifeGroupID
    LEFT JOIN Unit ut       ON ut.UnitID = lg.UnitID
    LEFT JOIN Subdistrict sd ON sd.SubdistrictID = ut.SubdistrictID
    WHERE sd.SubdistrictID IS NOT NULL
      AND ${buildChurchMemberClause('m')}
    GROUP BY sd.SubdistrictID, sd.SubdistrictName
    ORDER BY count DESC
    LIMIT 6
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

/* ── members by unit (subdistrict leader) ─────────────────── */

const getMembersByUnit = async (user) => {
  const sql = `
    SELECT ut.UnitName AS name, COUNT(m.MemberID) AS count
    FROM Member m
    INNER JOIN LifeGroup lg ON lg.LifeGroupID = m.LifeGroupID
    INNER JOIN Unit ut      ON ut.UnitID = lg.UnitID
    WHERE ${buildChurchMemberClause('m')}
      AND ut.SubdistrictID IN (
      SELECT leadership.ScopeID
      FROM Leadership leadership
      INNER JOIN ScopeType scopeType ON scopeType.ScopeTypeID = leadership.ScopeTypeID
      WHERE leadership.MemberID = ?
        AND leadership.IsActiveLeader = TRUE
        AND scopeType.ScopeName = 'Subdistrict'
    )
    GROUP BY ut.UnitID, ut.UnitName
    ORDER BY count DESC
  `;
  const [rows] = await pool.execute(sql, [user.memberId]);
  return rows;
};

/* ── members by life group (unit leader) ──────────────────── */

const getMembersByGroup = async (user) => {
  const sql = `
    SELECT lg.LifeGroupName AS name, COUNT(m.MemberID) AS count
    FROM Member m
    INNER JOIN LifeGroup lg ON lg.LifeGroupID = m.LifeGroupID
    WHERE ${buildChurchMemberClause('m')}
      AND lg.UnitID = (
      SELECT lg2.UnitID FROM LifeGroup lg2
      INNER JOIN Member m2 ON m2.LifeGroupID = lg2.LifeGroupID
      INNER JOIN \`User\` u2 ON u2.MemberID = m2.MemberID
      WHERE u2.MemberID = ? LIMIT 1
    )
    GROUP BY lg.LifeGroupID, lg.LifeGroupName
    ORDER BY count DESC
  `;
  const [rows] = await pool.execute(sql, [user.memberId]);
  return rows;
};

module.exports = {
  getSummaryCounts,
  getGenderDistribution,
  getAgeDistribution,
  getMembershipComposition,
  getStructureCounts,
  getMembersBySubdistrict,
  getMembersByUnit,
  getMembersByGroup,
};
