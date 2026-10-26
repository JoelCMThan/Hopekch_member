const { pool } = require('../config/db');
const { ROLES, buildScopeClause, buildChurchMemberClause } = require('../utils/permissions');

/* ── getInactiveMembers ───────────────────────────────────── */
const getInactiveMembers = async (user, { search, page = 1, limit = 20, reason }) => {
  const offset = (Number(page) - 1) * Number(limit);
  const scope  = buildScopeClause(user);
  const conds  = ['ma.IsActive = FALSE', buildChurchMemberClause('m')];
  const params = [];

  if (search) {
    conds.push('(m.FirstName LIKE ? OR m.LastName LIKE ? OR m.Email LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  if (reason) {
    conds.push('ma.InactiveReason = ?');
    params.push(reason);
  }

  const where     = `WHERE ${conds.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  const dataSQL = `
    SELECT m.MemberID, m.FirstName, m.LastName, m.Email, usr.Role,
           ma.InactiveReason, ma.AdditionalNotes AS InactiveNotes,
           lg.LifeGroupName,
           ut.UnitName,
           sd.SubdistrictName
    FROM MembershipActive ma
    INNER JOIN Member m       ON m.MemberID = ma.MemberID
    LEFT JOIN LifeGroup lg    ON lg.LifeGroupID = m.LifeGroupID
    LEFT JOIN Unit ut         ON ut.UnitID = lg.UnitID
    LEFT JOIN Subdistrict sd  ON sd.SubdistrictID = ut.SubdistrictID
    LEFT JOIN \`User\` usr     ON usr.MemberID = m.MemberID
    ${where}
    ORDER BY m.FirstName, m.LastName
    LIMIT ? OFFSET ?`;

  const countSQL = `
    SELECT COUNT(DISTINCT m.MemberID) AS total
    FROM MembershipActive ma
    INNER JOIN Member m       ON m.MemberID = ma.MemberID
    LEFT JOIN LifeGroup lg    ON lg.LifeGroupID = m.LifeGroupID
    LEFT JOIN Unit ut         ON ut.UnitID = lg.UnitID
    LEFT JOIN Subdistrict sd  ON sd.SubdistrictID = ut.SubdistrictID
    LEFT JOIN \`User\` usr     ON usr.MemberID = m.MemberID
    ${where}`;

  const [rows]      = await pool.execute(dataSQL, [...allParams, Number(limit), Number(offset)]);
  const [countRows] = await pool.execute(countSQL, allParams);

  return {
    members:    rows,
    total:      Number(countRows[0]?.total ?? 0),
    page:       Number(page),
    limit:      Number(limit),
    totalPages: Math.ceil(Number(countRows[0]?.total ?? 0) / Number(limit)),
  };
};

/* ── searchMembersForDeactivate ──────────────────────────── */
const searchMembersForDeactivate = async (user, keyword) => {
  const scope = buildScopeClause(user);
  const s     = `%${keyword}%`;

  const [rows] = await pool.execute(`
    SELECT m.MemberID, m.FirstName, m.LastName, m.Email,
           lg.LifeGroupName,
           ut.UnitName,
           sd.SubdistrictName
    FROM Member m
    LEFT JOIN LifeGroup lg    ON lg.LifeGroupID = m.LifeGroupID
    LEFT JOIN Unit ut         ON ut.UnitID = lg.UnitID
    LEFT JOIN Subdistrict sd  ON sd.SubdistrictID = ut.SubdistrictID
    LEFT JOIN MembershipActive ma ON ma.MemberID = m.MemberID
    LEFT JOIN \`User\` usr     ON usr.MemberID = m.MemberID
    WHERE ma.IsActive = TRUE
      AND ${buildChurchMemberClause('m')}
      AND (m.FirstName LIKE ? OR m.LastName LIKE ? OR m.Email LIKE ?)
      ${scope.clause}
    ORDER BY m.FirstName, m.LastName
    LIMIT 10`,
    [s, s, s, ...scope.params]
  );

  return rows;
};

/* ── deactivateMember ─────────────────────────────────────── */
const deactivateMember = async (memberId, reason, notes) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `UPDATE MembershipActive
       SET IsActive = FALSE,
           InactiveReason = ?,
           AdditionalNotes = ?
       WHERE MemberID = ?`,
      [reason, notes || null, Number(memberId)]
    );

    await conn.execute(
      `UPDATE Leadership
       SET IsActiveLeader = FALSE
       WHERE MemberID = ?
         AND IsActiveLeader = TRUE`,
      [Number(memberId)]
    );

    await conn.commit();
    return { success: result.affectedRows > 0 };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ── activateMember ───────────────────────────────────────── */
const activateMember = async (memberId) => {
  const [result] = await pool.execute(
    `UPDATE MembershipActive
     SET IsActive = TRUE,
         InactiveReason = NULL,
         AdditionalNotes = NULL
     WHERE MemberID = ?`,
    [Number(memberId)]
  );

  return { success: result.affectedRows > 0 };
};

/* ── isMemberWithinScope ───────────────────────────────────── */
const isMemberWithinScope = async (user, targetMemberId) => {
  const { role } = user;

  if (role === ROLES.MASTER_ADMIN || role === ROLES.ADMIN || role === ROLES.MANAGER) {
    return true;
  }

  const scope = buildScopeClause(user);

  const [rows] = await pool.execute(
    `SELECT m.MemberID
     FROM Member m
     LEFT JOIN LifeGroup lg ON lg.LifeGroupID = m.LifeGroupID
     LEFT JOIN Unit ut      ON ut.UnitID = lg.UnitID
     LEFT JOIN \`User\` usr  ON usr.MemberID = m.MemberID
     WHERE m.MemberID = ?
       ${scope.clause}
     LIMIT 1`,
    [Number(targetMemberId), ...scope.params]
  );

  return rows.length > 0;
};

// Update only inactive details, without changing membership or leadership status.
const updateInactiveDetails = async (memberId, reason, notes) => {
  const [result] = await pool.execute(
    `UPDATE MembershipActive SET InactiveReason = ?, AdditionalNotes = ?
     WHERE MemberID = ? AND IsActive = FALSE`,
    [reason, notes, memberId]
  );
  return { success: result.affectedRows > 0 };
};

module.exports = {
  updateInactiveDetails,
  getInactiveMembers,
  searchMembersForDeactivate,
  deactivateMember,
  activateMember,
  isMemberWithinScope,
};
