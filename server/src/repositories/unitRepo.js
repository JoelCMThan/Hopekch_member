const organizationRepo = require('./organizationRepo');
const { pool } = require('../config/db');
const { buildUnitScopeClause, buildChurchMemberClause } = require('../utils/permissions');

/* ── leader join fragment ───────────────────────────────────
   ldr = Leadership row, lm = leader Member row       */
const LEADER_JOIN = `
  LEFT JOIN Leadership ldr
    ON  ldr.ScopeID       = u.UnitID
    AND ldr.ScopeTypeID   = (SELECT ScopeTypeID FROM ScopeType WHERE ScopeName = 'Unit' LIMIT 1)
    AND ldr.IsActiveLeader = TRUE
  LEFT JOIN Member lm ON lm.MemberID = ldr.MemberID
`;

/* ── upsert leader ─────────────────────────────────────────── */
const upsertUnitLeader = (conn, id, leaderMemberId) =>
  organizationRepo.addLeader(conn, 'unit', id, leaderMemberId);

/* ── getUnits ────────────────────────────────────────────── */
const getUnits = async ({ user, search, subdistrictId, page = 1, limit = 20, exportAll = false }) => {
  const offset = (page - 1) * limit;
  const scope  = buildUnitScopeClause(user);
  const conds  = ['1 = 1'];
  const params = [];

  if (search) {
    conds.push('(u.UnitName LIKE ? OR sd.SubdistrictName LIKE ? OR lm.FirstName LIKE ? OR lm.LastName LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  if (subdistrictId) {
    conds.push('u.SubdistrictID = ?');
    params.push(Number(subdistrictId));
  }

  const where     = `WHERE ${conds.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  const dataSQL = `
    SELECT u.UnitID, u.UnitName, u.SubdistrictID, sd.SubdistrictName,
           MIN(lm.MemberID) AS MemberID, MIN(lm.FirstName) AS FirstName, MIN(lm.LastName) AS LastName,
           COUNT(DISTINCT m.MemberID) AS MemberCount,
           COUNT(DISTINCT lg.LifeGroupID) AS LifeGroupCount
    FROM Unit u
    LEFT JOIN Subdistrict sd ON sd.SubdistrictID = u.SubdistrictID
    ${LEADER_JOIN}
    LEFT JOIN LifeGroup lg   ON lg.UnitID = u.UnitID
    LEFT JOIN Member m       ON m.LifeGroupID = lg.LifeGroupID
      AND ${buildChurchMemberClause('m')}
    ${where}
    GROUP BY u.UnitID, u.UnitName, u.SubdistrictID, sd.SubdistrictName
    ORDER BY u.UnitName
    ${exportAll ? '' : 'LIMIT ? OFFSET ?'}`;

  const countSQL = `
    SELECT COUNT(DISTINCT u.UnitID) AS total
    FROM Unit u
    LEFT JOIN Subdistrict sd ON sd.SubdistrictID = u.SubdistrictID
    ${LEADER_JOIN}
    ${where}`;

  const [rows]      = await pool.execute(dataSQL, exportAll ? allParams : [...allParams, limit, offset]);
  const [countRows] = await pool.execute(countSQL, allParams);

  return {
    units:      await organizationRepo.enrich('unit', rows),
    total:      countRows[0]?.total ?? 0,
    page,
    limit,
    totalPages: Math.ceil((countRows[0]?.total ?? 0) / limit),
  };
};

/* ── getUnitById ─────────────────────────────────────────── */
const getUnitById = async (unitId) => {
  const [rows] = await pool.execute(`
    SELECT u.UnitID, u.UnitName, u.SubdistrictID, sd.SubdistrictName,
           MIN(lm.MemberID) AS MemberID, MIN(lm.FirstName) AS FirstName, MIN(lm.LastName) AS LastName, MIN(lm.Email) AS Email,
           COUNT(DISTINCT m.MemberID) AS MemberCount,
           COUNT(DISTINCT lg.LifeGroupID) AS LifeGroupCount
    FROM Unit u
    LEFT JOIN Subdistrict sd ON sd.SubdistrictID = u.SubdistrictID
    ${LEADER_JOIN}
    LEFT JOIN LifeGroup lg   ON lg.UnitID = u.UnitID
    LEFT JOIN Member m       ON m.LifeGroupID = lg.LifeGroupID
      AND ${buildChurchMemberClause('m')}
    WHERE u.UnitID = ?
    GROUP BY u.UnitID, u.UnitName, u.SubdistrictID, sd.SubdistrictName`,
    [unitId]
  );
  return rows[0] ? (await organizationRepo.enrich('unit', [rows[0]]))[0] : null;
};

/* ── createUnit ──────────────────────────────────────────── */
const createUnit = async (data) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      unitName,
      subdistrictId,
      leaderMemberId = null,
    } = data;

    const [result] = await conn.execute(
      `INSERT INTO Unit (UnitName, SubdistrictID) VALUES (?, ?)`,
      [unitName, Number(subdistrictId)]
    );

    const newUnitId = result.insertId;
    await upsertUnitLeader(conn, newUnitId, leaderMemberId);

    await conn.commit();
    return getUnitById(newUnitId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ── updateUnit ──────────────────────────────────────────── */
const updateUnit = async (unitId, data) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `UPDATE Unit SET UnitName = ?, SubdistrictID = ? WHERE UnitID = ?`,
      [data.unitName, Number(data.subdistrictId), unitId]
    );

    await upsertUnitLeader(conn, unitId, data.leaderMemberId);

    await conn.commit();
    return getUnitById(unitId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ── deleteUnit ──────────────────────────────────────────── */
const deleteUnit = async (unitId) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `UPDATE Leadership SET IsActiveLeader = FALSE
       WHERE ScopeID     = ?
         AND ScopeTypeID = (SELECT ScopeTypeID FROM ScopeType WHERE ScopeName = 'Unit' LIMIT 1)`,
      [unitId]
    );

    await conn.execute(`DELETE FROM Unit WHERE UnitID = ?`, [unitId]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ── getSubdistricts ─────────────────────────────────────── */
const getSubdistricts = async () => {
  const [rows] = await pool.execute(`
    SELECT SubdistrictID, SubdistrictName
    FROM Subdistrict
    ORDER BY SubdistrictName`
  );
  return rows;
};

module.exports = {
  getUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
  getSubdistricts,
};
