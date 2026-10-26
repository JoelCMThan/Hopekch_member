/* server/src/repositories/analyticsRepo.js */

const { pool } = require('../config/db');
const { ROLES, buildChurchMemberClause } = require('../utils/permissions');

/* ── Scope helpers ───────────────────────────────────────────── */

/**
 * Returns the SubdistrictID managed by a Subdistrict Leader.
 * Admin / Manager do not need this.
 */
const getLeaderSubdistrictId = async (user) => {
  if (user.role !== ROLES.SUBDISTRICT_LEADER) return null;

  const sql = `
    SELECT leadership.ScopeID AS SubdistrictID
    FROM Leadership leadership
    INNER JOIN ScopeType scopeType ON scopeType.ScopeTypeID = leadership.ScopeTypeID
    WHERE leadership.MemberID = ?
      AND leadership.IsActiveLeader = TRUE
      AND scopeType.ScopeName = 'Subdistrict'
    LIMIT 1
  `;

  const [rows] = await pool.execute(sql, [user.memberId]);
  return rows[0]?.SubdistrictID ?? null;
};

/**
 * Builds filters shared by analytics queries.
 *
 * Date filtering is intentionally NOT handled here because only the
 * Member Growth Trends chart uses MemberSince as a historical dimension.
 */
const buildMemberFilters = async (user, filters = {}) => {
  const { subdistrictId, unitId, lifeGroupId } = filters;

  const conditions = [];
  const params = [];

  if (user.role === ROLES.SUBDISTRICT_LEADER) {
    const subdistrictId = await getLeaderSubdistrictId(user);

    if (!subdistrictId) {
      // Prevent an unscoped query if the leader has no valid subdistrict.
      conditions.push('1 = 0');
    } else {
      conditions.push('ut.SubdistrictID = ?');
      params.push(subdistrictId);
    }
  }

  if ([ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER].includes(user.role) && subdistrictId) {
    conditions.push('ut.SubdistrictID = ?');
    params.push(subdistrictId);
  }

  if (unitId) {
    conditions.push('ut.UnitID = ?');
    params.push(unitId);
  }

  if (lifeGroupId) {
    conditions.push('lg.LifeGroupID = ?');
    params.push(lifeGroupId);
  }

  return {
    clause: conditions.length
      ? ` AND ${conditions.join(' AND ')}`
      : '',
    params,
  };
};

const memberJoins = `
  FROM Member m
  LEFT JOIN MemberEngagement ma
    ON ma.MemberID = m.MemberID
  LEFT JOIN MembershipStatus ms
    ON ms.MemberID = m.MemberID
  LEFT JOIN MembershipActive msa
    ON msa.MemberID = m.MemberID
  LEFT JOIN LifeGroup lg
    ON lg.LifeGroupID = m.LifeGroupID
  LEFT JOIN Unit ut
    ON ut.UnitID = lg.UnitID
`;

const churchMemberClause = buildChurchMemberClause('m');

const getSundayAttendanceTrend = async (filters = {}) => {
  const conditions = ["SessionTime = 'Sunday Service'"];
  const params = [];

  if (filters.startDate && filters.endDate) {
    conditions.push('ServiceDate BETWEEN ? AND ?');
    params.push(filters.startDate, filters.endDate);
  } else {
    switch (filters.dateRange) {
      case '30d': conditions.push('ServiceDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)'); break;
      case '90d': conditions.push('ServiceDate >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)'); break;
      case '1y': conditions.push('ServiceDate >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)'); break;
      case 'ytd': conditions.push('ServiceDate >= MAKEDATE(YEAR(CURDATE()), 1)'); break;
      default: break;
    }
  }

  const [rows] = await pool.execute(`
    SELECT DATE_FORMAT(ServiceDate, '%Y-%m-%d') AS serviceDate,
           DATE_FORMAT(ServiceDate, '%d %b %Y') AS label,
           AttendanceCount AS count
    FROM ServiceAttendance
    WHERE ${conditions.join(' AND ')}
    ORDER BY ServiceDate ASC
  `, params);
  return rows.map(row => ({ ...row, count: Number(row.count) }));
};

const saveSundayAttendance = async ({ serviceDate, attendanceCount, remarks = null }) => {
  const [existing] = await pool.execute(`
    SELECT AttendanceID FROM ServiceAttendance
    WHERE ServiceDate = ? AND SessionTime = 'Sunday Service'
    LIMIT 1
  `, [serviceDate]);

  if (existing.length === 0) {
    const [result] = await pool.execute(`
      INSERT INTO ServiceAttendance (ServiceDate, SessionTime, AttendanceCount, Remarks)
      VALUES (?, 'Sunday Service', ?, ?)
    `, [serviceDate, attendanceCount, remarks || null]);
    return { attendanceId: result.insertId, serviceDate, attendanceCount, updated: false };
  }

  await pool.execute(`
    UPDATE ServiceAttendance SET AttendanceCount = ?, Remarks = ?
    WHERE AttendanceID = ?
  `, [attendanceCount, remarks || null, existing[0].AttendanceID]);
  return { attendanceId: existing[0].AttendanceID, serviceDate, attendanceCount, updated: true };
};

/* ── Filter options ──────────────────────────────────────────── */

/**
 * Returns Units available to the current user.
 *
 * Admin / Manager:
 *   all Units
 *
 * Subdistrict Leader:
 *   only Units in their own Subdistrict
 */
const getSubdistrictOptions = async (user) => {
  if (![ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER].includes(user.role)) return [];
  const [rows] = await pool.execute('SELECT SubdistrictID AS id, SubdistrictName AS name FROM Subdistrict ORDER BY SubdistrictName');
  return rows;
};

const getUnitOptions = async (user, selectedSubdistrictId = null) => {
  let sql = `
    SELECT
      ut.UnitID AS id,
      ut.UnitName AS name
    FROM Unit ut
    WHERE 1 = 1
  `;

  const params = [];

  if (user.role === ROLES.SUBDISTRICT_LEADER) {
    const subdistrictId = await getLeaderSubdistrictId(user);

    if (!subdistrictId) return [];

    sql += ' AND ut.SubdistrictID = ?';
    params.push(subdistrictId);
  }

  if ([ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER].includes(user.role) && selectedSubdistrictId) {
    sql += ' AND ut.SubdistrictID = ?';
    params.push(selectedSubdistrictId);
  }

  sql += ' ORDER BY ut.UnitName ASC';

  const [rows] = await pool.execute(sql, params);
  return rows;
};

/**
 * Returns Life Groups available to the current user.
 *
 * unitId is optional. If supplied, only groups under that Unit are returned.
 */
const getLifeGroupOptions = async (user, unitId = null, selectedSubdistrictId = null) => {
  let sql = `
    SELECT
      lg.LifeGroupID AS id,
      lg.LifeGroupName AS name,
      lg.UnitID AS unitId
    FROM LifeGroup lg
    INNER JOIN Unit ut ON ut.UnitID = lg.UnitID
    WHERE 1 = 1
  `;

  const params = [];

  if (user.role === ROLES.SUBDISTRICT_LEADER) {
    const subdistrictId = await getLeaderSubdistrictId(user);

    if (!subdistrictId) return [];

    sql += ' AND ut.SubdistrictID = ?';
    params.push(subdistrictId);
  }

  if (unitId) {
    sql += ' AND ut.UnitID = ?';
    params.push(unitId);
  }

  if ([ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER].includes(user.role) && selectedSubdistrictId) {
    sql += ' AND ut.SubdistrictID = ?';
    params.push(selectedSubdistrictId);
  }

  sql += ' ORDER BY lg.LifeGroupName ASC';

  const [rows] = await pool.execute(sql, params);
  return rows;
};

/* ── 1. Group Meeting Distribution ──────────────────────────── */

const getGroupMeetingDistribution = async (user, filters = {}) => {
  const scope = await buildMemberFilters(user, filters);

  /*
   * Start from LifeGroup so newly created groups without members also appear.
   * Keep the same hierarchy filters and permission scope as other analytics.
   */
  const sql = `
    SELECT DISTINCT
      lg.LifeGroupID AS lifeGroupId,
      lg.LifeGroupName AS lifeGroupName,
      lg.MeetingAddress AS meetingAddress,
      lg.Latitude AS latitude,
      lg.Longitude AS longitude,
      ut.UnitID AS unitId,
      ut.UnitName AS unitName
    FROM LifeGroup lg
    LEFT JOIN Unit ut ON ut.UnitID = lg.UnitID
    WHERE lg.LifeGroupID IS NOT NULL
      AND lg.Latitude IS NOT NULL
      AND lg.Longitude IS NOT NULL
      ${scope.clause}
    ORDER BY lg.LifeGroupName ASC
  `;

  const [rows] = await pool.execute(sql, scope.params);
  return rows;
};

/* ── 2. Member Engagement ───────────────────────────────────── */

const getMemberAddressDistribution = async (user, filters = {}) => {
  const scope = await buildMemberFilters(user, filters);
  const [rows] = await pool.execute(`
    SELECT m.MemberID AS memberId,
      CONCAT_WS(' ', m.FirstName, m.LastName) AS memberName,
      CONCAT_WS(', ', NULLIF(a.StreetAddress, ''), NULLIF(a.City, ''),
        NULLIF(a.State, ''), NULLIF(a.PostalCode, ''), NULLIF(a.Country, '')) AS address,
      a.Latitude AS latitude, a.Longitude AS longitude,
      lg.LifeGroupName AS lifeGroupName, ut.UnitName AS unitName
    ${memberJoins}
    INNER JOIN Address a ON a.MemberID = m.MemberID
    WHERE ${churchMemberClause}
      AND a.Latitude BETWEEN -90 AND 90
      AND a.Longitude BETWEEN -180 AND 180
      ${scope.clause}
    ORDER BY m.FirstName, m.LastName, m.MemberID
  `, scope.params);
  return rows;
};

const getMemberEngagement = async (user, filters = {}) => {
  const scope = await buildMemberFilters(user, filters);

  const sql = `
    SELECT
      COUNT(*) AS totalMembers,

      SUM(
        CASE
          WHEN COALESCE(ma.IsActiveEngage, 0) = 1
           AND COALESCE(ma.IsActiveLifeGroup, 0) = 1
          THEN 1 ELSE 0
        END
      ) AS lifeGroup,

      SUM(
        CASE
          WHEN COALESCE(ma.IsActiveEngage, 0) = 1
           AND COALESCE(ma.IsActiveSundayService, 0) = 1
          THEN 1 ELSE 0
        END
      ) AS sundayService,

      SUM(
        CASE
          WHEN COALESCE(ma.IsActiveEngage, 0) = 1
           AND COALESCE(ma.IsActiveServing, 0) = 1
          THEN 1 ELSE 0
        END
      ) AS serving

    ${memberJoins}
    WHERE ${churchMemberClause}
      AND COALESCE(msa.IsActive, TRUE) = TRUE
      ${scope.clause}
  `;

  const [rows] = await pool.execute(sql, scope.params);

  const row = rows[0] ?? {};
  const total = Number(row.totalMembers ?? 0);

  const lifeGroup = Number(row.lifeGroup ?? 0);
  const sundayService = Number(row.sundayService ?? 0);
  const serving = Number(row.serving ?? 0);

  return {
    totalMembers: total,

    lifeGroup: {
      count: lifeGroup,
      percentage: total
        ? Math.round((lifeGroup / total) * 100)
        : 0,
    },

    sundayService: {
      count: sundayService,
      percentage: total
        ? Math.round((sundayService / total) * 100)
        : 0,
    },

    serving: {
      count: serving,
      percentage: total
        ? Math.round((serving / total) * 100)
        : 0,
    },
  };
};

/* ── 3. Member Growth Trends ────────────────────────────────── */

/**
 * Converts the selected date-range option into a SQL condition.
 *
 * Expected values:
 * 30d  = last 30 days
 * 90d  = last 90 days
 * 1y   = last 1 year
 * ytd  = year to date
 * all  = all available history
 */
const buildGrowthDateFilter = (dateRange) => {
  switch (dateRange) {
    case '30d':
      return 'm.MemberSince >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';

    case '90d':
      return 'm.MemberSince >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)';

    case '1y':
      return 'm.MemberSince >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';

    case 'ytd':
      return 'm.MemberSince >= MAKEDATE(YEAR(CURDATE()), 1)';

    case 'all':
    default:
      return '1 = 1';
  }
};

const getMemberGrowthTrends = async (user, filters = {}) => {
  const scope = await buildMemberFilters(user, filters);
  const dateCondition = buildGrowthDateFilter(filters.dateRange);

  const sql = `
    SELECT
      DATE_FORMAT(m.MemberSince, '%Y-%m') AS period,
      DATE_FORMAT(m.MemberSince, '%b %Y') AS label,
      COUNT(*) AS count
    ${memberJoins}
    WHERE m.MemberSince IS NOT NULL
      AND ${churchMemberClause}
      AND ${dateCondition}
      ${scope.clause}
    GROUP BY
      DATE_FORMAT(m.MemberSince, '%Y-%m'),
      DATE_FORMAT(m.MemberSince, '%b %Y')
    ORDER BY period ASC
  `;

  const [rows] = await pool.execute(sql, scope.params);

  return rows.map(row => ({
    period: row.period,
    label: row.label,
    count: Number(row.count),
  }));
};

/* ── 4. Membership Type Distribution ───────────────────────── */

const getMembershipTypeDistribution = async (user, filters = {}) => {
  const scope = await buildMemberFilters(user, filters);

  const sql = `
    SELECT
      COALESCE(ms.MembershipType, 'Member') AS type,
      COUNT(*) AS count
    ${memberJoins}
    WHERE ${churchMemberClause}
      ${scope.clause}
    GROUP BY COALESCE(ms.MembershipType, 'Member')
    ORDER BY FIELD(
      type,
      'Member',
      'Visitor',
      'Consistent Visitor'
    )
  `;

  const [rows] = await pool.execute(sql, scope.params);

  return rows.map(row => ({
    type: row.type,
    count: Number(row.count),
  }));
};

/* ── 5. Members by Life Group ───────────────────────────────── */

const getMembersByLifeGroup = async (user, filters = {}) => {
  const scope = await buildMemberFilters(user, filters);

  const sql = `
    SELECT
      lg.LifeGroupID AS lifeGroupId,
      lg.LifeGroupName AS name,
      ut.UnitID AS unitId,
      ut.UnitName AS unitName,
      COUNT(m.MemberID) AS count
    ${memberJoins}
    WHERE lg.LifeGroupID IS NOT NULL
      AND ${churchMemberClause}
      ${scope.clause}
    GROUP BY
      lg.LifeGroupID,
      lg.LifeGroupName,
      ut.UnitID,
      ut.UnitName
    ORDER BY count DESC, lg.LifeGroupName ASC
  `;

  const [rows] = await pool.execute(sql, scope.params);

  return rows.map(row => ({
    lifeGroupId: row.lifeGroupId,
    name: row.name,
    unitId: row.unitId,
    unitName: row.unitName,
    count: Number(row.count),
  }));
};

/* ── 6. Members by Unit ─────────────────────────────────────── */

const getMembersByUnit = async (user, filters = {}) => {
  const scope = await buildMemberFilters(user, filters);

  const sql = `
    SELECT
      ut.UnitID AS unitId,
      ut.UnitName AS name,
      COUNT(m.MemberID) AS count
    ${memberJoins}
    WHERE ut.UnitID IS NOT NULL
      AND ${churchMemberClause}
      ${scope.clause}
    GROUP BY
      ut.UnitID,
      ut.UnitName
    ORDER BY count DESC, ut.UnitName ASC
  `;

  const [rows] = await pool.execute(sql, scope.params);

  return rows.map(row => ({
    unitId: row.unitId,
    name: row.name,
    count: Number(row.count),
  }));
};

/* ── Combined analytics ─────────────────────────────────────── */

const getAgeDistribution = async (user, filters = {}) => {
  const scope = await buildMemberFilters(user, filters);
  const [rows] = await pool.execute(`
    SELECT CASE
      WHEN TIMESTAMPDIFF(YEAR, m.BirthDate, CURDATE()) < 19 THEN '0-18'
      WHEN TIMESTAMPDIFF(YEAR, m.BirthDate, CURDATE()) < 30 THEN '19-29'
      WHEN TIMESTAMPDIFF(YEAR, m.BirthDate, CURDATE()) < 40 THEN '30-39'
      WHEN TIMESTAMPDIFF(YEAR, m.BirthDate, CURDATE()) < 50 THEN '40-49'
      WHEN TIMESTAMPDIFF(YEAR, m.BirthDate, CURDATE()) < 60 THEN '50-59'
      ELSE '60+'
    END AS bracket, COUNT(*) AS count
    ${memberJoins}
    WHERE m.BirthDate IS NOT NULL
      AND ${churchMemberClause}
      ${scope.clause}
    GROUP BY bracket
    ORDER BY FIELD(bracket, '0-18','19-29','30-39','40-49','50-59','60+')
  `, scope.params);
  return rows;
};

const getAnalyticsData = async (user, filters = {}) => {
  const [
    sundayAttendanceTrend,
    groupMeetingDistribution,
    memberAddressDistribution,
    memberEngagement,
    memberGrowthTrends,
    membershipTypeDistribution,
    membersByLifeGroup,
    membersByUnit,
    ageDistribution,
  ] = await Promise.all([
    getSundayAttendanceTrend(filters),
    getGroupMeetingDistribution(user, filters),
    getMemberAddressDistribution(user, filters),
    getMemberEngagement(user, filters),
    getMemberGrowthTrends(user, filters),
    getMembershipTypeDistribution(user, filters),
    getMembersByLifeGroup(user, filters),
    getMembersByUnit(user, filters),
    getAgeDistribution(user, filters),
  ]);

  return {
    sundayAttendanceTrend,
    groupMeetingDistribution,
    memberAddressDistribution,
    memberEngagement,
    memberGrowthTrends,
    membershipTypeDistribution,
    membersByLifeGroup,
    membersByUnit,
    ageDistribution,
  };
};

module.exports = {
  getSundayAttendanceTrend,
  saveSundayAttendance,
  getSubdistrictOptions,
  getAgeDistribution,
  getUnitOptions,
  getLifeGroupOptions,

  getGroupMeetingDistribution,
  getMemberAddressDistribution,
  getMemberEngagement,
  getMemberGrowthTrends,
  getMembershipTypeDistribution,
  getMembersByLifeGroup,
  getMembersByUnit,

  getAnalyticsData,
};
