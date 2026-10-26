const organizationRepo = require('./organizationRepo');
const { pool } = require('../config/db');
const { buildSubdistrictScopeClause, buildChurchMemberClause } = require('../utils/permissions');

/* ── leader join fragment ───────────────────────────────────
   ldr = Leadership row, lm = leader Member row */
const LEADER_JOIN = `
  LEFT JOIN Leadership ldr
    ON  ldr.ScopeID = sd.SubdistrictID
    AND ldr.ScopeTypeID = (
      SELECT ScopeTypeID
      FROM ScopeType
      WHERE ScopeName = 'Subdistrict'
      LIMIT 1
    )
    AND ldr.IsActiveLeader = TRUE
  LEFT JOIN Member lm
    ON lm.MemberID = ldr.MemberID
`;

/* ── upsert leader ────────────────────────────────────────── */
const upsertSubdistrictLeader = (conn, id, leaderMemberId) =>
  organizationRepo.addLeader(conn, 'subdistrict', id, leaderMemberId);

/* ── getSubdistricts ─────────────────────────────────────── */
const getSubdistricts = async ({
  user,
  search,
  page = 1,
  limit = 20,
}) => {
  const offset = (page - 1) * limit;

  const scope = buildSubdistrictScopeClause(user);

  const conds = ['1 = 1'];
  const params = [];

  if (search) {
    const s = `%${search}%`;

    conds.push(`
      (
        sd.SubdistrictName LIKE ?
        OR lm.FirstName LIKE ?
        OR lm.LastName LIKE ?
      )
    `);

    params.push(s, s, s);
  }

  const where = `WHERE ${conds.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  const dataSQL = `
    SELECT
      sd.SubdistrictID,
      sd.SubdistrictName,

      MIN(lm.MemberID) AS MemberID,
      MIN(lm.FirstName) AS FirstName,
      MIN(lm.LastName) AS LastName,

      COUNT(DISTINCT u.UnitID) AS UnitCount,
      COUNT(DISTINCT lg.LifeGroupID) AS LifeGroupCount,
      COUNT(DISTINCT m.MemberID) AS MemberCount

    FROM Subdistrict sd

    ${LEADER_JOIN}

    LEFT JOIN Unit u
      ON u.SubdistrictID = sd.SubdistrictID

    LEFT JOIN LifeGroup lg
      ON lg.UnitID = u.UnitID

    LEFT JOIN Member m
      ON m.LifeGroupID = lg.LifeGroupID
      AND ${buildChurchMemberClause('m')}

    ${where}

    GROUP BY
      sd.SubdistrictID,
      sd.SubdistrictName

    ORDER BY sd.SubdistrictName

    LIMIT ? OFFSET ?
  `;

  const countSQL = `
    SELECT COUNT(DISTINCT sd.SubdistrictID) AS total

    FROM Subdistrict sd

    ${LEADER_JOIN}

    ${where}
  `;

  const [rows] = await pool.execute(
    dataSQL,
    [...allParams, limit, offset]
  );

  const [countRows] = await pool.execute(
    countSQL,
    allParams
  );

  return {
    subdistricts: await organizationRepo.enrich('subdistrict', rows),
    total: countRows[0]?.total ?? 0,
    page,
    limit,
    totalPages: Math.ceil(
      (countRows[0]?.total ?? 0) / limit
    ),
  };
};

/* ── getSubdistrictById ──────────────────────────────────── */
const getSubdistrictById = async (subdistrictId) => {
  const [rows] = await pool.execute(
    `
    SELECT
      sd.SubdistrictID,
      sd.SubdistrictName,

      MIN(lm.MemberID) AS MemberID,
      MIN(lm.FirstName) AS FirstName,
      MIN(lm.LastName) AS LastName,
      MIN(lm.Email) AS Email,

      COUNT(DISTINCT u.UnitID) AS UnitCount,
      COUNT(DISTINCT lg.LifeGroupID) AS LifeGroupCount,
      COUNT(DISTINCT m.MemberID) AS MemberCount

    FROM Subdistrict sd

    ${LEADER_JOIN}

    LEFT JOIN Unit u
      ON u.SubdistrictID = sd.SubdistrictID

    LEFT JOIN LifeGroup lg
      ON lg.UnitID = u.UnitID

    LEFT JOIN Member m
      ON m.LifeGroupID = lg.LifeGroupID
      AND ${buildChurchMemberClause('m')}

    WHERE sd.SubdistrictID = ?

    GROUP BY
      sd.SubdistrictID,
      sd.SubdistrictName
    `,
    [subdistrictId]
  );

  return rows[0] ? (await organizationRepo.enrich('subdistrict', [rows[0]]))[0] : null;
};

/* ── createSubdistrict ───────────────────────────────────── */
const createSubdistrict = async (data) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const {
      subdistrictName,
      leaderMemberId = null,
    } = data;

    const [result] = await conn.execute(
      `
      INSERT INTO Subdistrict
      (
        SubdistrictName
      )
      VALUES (?)
      `,
      [subdistrictName]
    );

    const newId = result.insertId;

    await upsertSubdistrictLeader(
      conn,
      newId,
      leaderMemberId
    );

    await conn.commit();

    return getSubdistrictById(newId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ── updateSubdistrict ───────────────────────────────────── */
const updateSubdistrict = async (
  subdistrictId,
  data
) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      `
      UPDATE Subdistrict
      SET SubdistrictName = ?
      WHERE SubdistrictID = ?
      `,
      [
        data.subdistrictName,
        subdistrictId,
      ]
    );

    await upsertSubdistrictLeader(
      conn,
      subdistrictId,
      data.leaderMemberId
    );

    await conn.commit();

    return getSubdistrictById(subdistrictId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ── deleteSubdistrict ───────────────────────────────────── */
const deleteSubdistrict = async (
  subdistrictId
) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      `
      UPDATE Leadership
      SET IsActiveLeader = FALSE
      WHERE ScopeID = ?
      AND ScopeTypeID = (
        SELECT ScopeTypeID
        FROM ScopeType
        WHERE ScopeName='Subdistrict'
        LIMIT 1
      )
      `,
      [subdistrictId]
    );

    await conn.execute(
      `
      DELETE FROM Subdistrict
      WHERE SubdistrictID = ?
      `,
      [subdistrictId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  getSubdistricts,
  getSubdistrictById,
  createSubdistrict,
  updateSubdistrict,
  deleteSubdistrict,
};
