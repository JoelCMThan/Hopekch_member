const { pool } = require('../config/db');
const { buildGroupScopeClause, buildUnitScopeClause, buildSubdistrictScopeClause } = require('../utils/permissions');

const types = {
  group: { table: 'LifeGroup', id: 'LifeGroupID', alias: 'g', scope: buildGroupScopeClause,
    from: 'LifeGroup g LEFT JOIN Unit u ON u.UnitID = g.UnitID LEFT JOIN Subdistrict sd ON sd.SubdistrictID = u.SubdistrictID',
    fields: 'g.MeetingAddress, g.Latitude, g.Longitude, u.IsActive AS UnitIsActive, sd.IsActive AS SubdistrictIsActive',
    usable: 'g.IsActive = TRUE AND u.UnitID IS NOT NULL AND u.IsActive = TRUE AND sd.SubdistrictID IS NOT NULL AND sd.IsActive = TRUE' },
  unit: { table: 'Unit', id: 'UnitID', alias: 'u', scope: buildUnitScopeClause,
    from: 'Unit u LEFT JOIN Subdistrict sd ON sd.SubdistrictID = u.SubdistrictID',
    fields: 'sd.IsActive AS SubdistrictIsActive', usable: 'u.IsActive = TRUE AND sd.SubdistrictID IS NOT NULL AND sd.IsActive = TRUE' },
  subdistrict: { table: 'Subdistrict', id: 'SubdistrictID', alias: 'sd', scope: buildSubdistrictScopeClause,
    from: 'Subdistrict sd', fields: '', usable: 'sd.IsActive = TRUE' },
};

const groupUnusableReason = (state) => {
  if (Number(state.IsActive) !== 1) return 'the Life Group is inactive.';
  if (state.UnitIsActive == null) return 'the Life Group has no valid Unit.';
  if (Number(state.UnitIsActive) !== 1) return 'the parent Unit is inactive.';
  if (state.SubdistrictIsActive == null) return 'the Unit has no valid Subdistrict.';
  if (Number(state.SubdistrictIsActive) !== 1) return 'the parent Subdistrict is inactive.';
  return null;
};

const getStates = async (kind, ids, db = pool, user = null, lock = false) => {
  if (!ids.length) return [];
  const t = types[kind];
  const scope = user ? t.scope(user) : { clause: '', params: [] };
  const [rows] = await db.execute(`SELECT ${t.alias}.${t.id}, ${t.alias}.IsActive,
    COALESCE((${t.usable}), FALSE) AS IsUsable ${t.fields ? ', ' + t.fields : ''}
    FROM ${t.from} WHERE ${t.alias}.${t.id} IN (${ids.map(() => '?').join(',')})
    ${scope.clause} ${lock ? 'FOR UPDATE' : ''}`, [...ids, ...scope.params]);
  return rows.map(row => ({ ...row, UnusableReason: kind === 'group' ? groupUnusableReason(row) : Number(row.IsActive) !== 1 ? `the ${kind === 'unit' ? 'Unit' : 'Subdistrict'} is inactive.` : kind === 'unit' && row.SubdistrictIsActive == null ? 'the Unit has no valid Subdistrict.' : kind === 'unit' && Number(row.SubdistrictIsActive) !== 1 ? 'the parent Subdistrict is inactive.' : null }));
};

const enrich = async (kind, records) => {
  if (!records.length) return [];
  const t = types[kind];
  const states = await getStates(kind, records.map(row => row[t.id]));
  const byId = new Map(states.map(row => [Number(row[t.id]), row]));
  const [assignments] = await pool.execute(`
    SELECT DISTINCT l.ScopeID, m.MemberID, m.FirstName, m.LastName, m.Email,
      CASE WHEN st.ScopeName IN ('Unit', 'LifeGroup') AND (LOWER(l.LeadershipType) LIKE '%assistant%'
        OR (st.ScopeName = 'Unit' AND usr.Role = 'assistantunit_leader')
        OR (st.ScopeName = 'LifeGroup' AND usr.Role = 'assistantlg_leader'))
        THEN 'Assistant Leader' ELSE 'Leader' END AS LeadershipType
    FROM Leadership l
    INNER JOIN ScopeType st ON st.ScopeTypeID = l.ScopeTypeID
    INNER JOIN Member m ON m.MemberID = l.MemberID
    LEFT JOIN \`User\` usr ON usr.MemberID = m.MemberID
    WHERE st.ScopeName = ? AND l.IsActiveLeader = TRUE
      AND l.ScopeID IN (${records.map(() => '?').join(',')})
    ORDER BY m.FirstName, m.LastName, m.MemberID
  `, [t.table, ...records.map(row => row[t.id])]);

  return records.map(row => {
    const assigned = assignments.filter(leader => Number(leader.ScopeID) === Number(row[t.id]));
    const Leaders = assigned.filter(leader => leader.LeadershipType === 'Leader');
    const AssistantLeaders = assigned.filter(leader => leader.LeadershipType === 'Assistant Leader');
    return {
      ...row,
      ...byId.get(Number(row[t.id])),
      MemberID: Leaders[0]?.MemberID ?? null,
      FirstName: Leaders[0]?.FirstName ?? null,
      LastName: Leaders[0]?.LastName ?? null,
      Email: Leaders[0]?.Email ?? null,
      Leaders,
      LeaderNames: Leaders.map(leader => [leader.FirstName, leader.LastName].filter(Boolean).join(' ')).join(', '),
      ...(kind !== 'subdistrict' ? {
        AssistantLeaders,
        AssistantLeaderNames: AssistantLeaders.map(leader => [leader.FirstName, leader.LastName].filter(Boolean).join(' ')).join(', '),
      } : {}),
    };
  });
};

// Adding one leader must not remove the other leaders or assistants in the scope.
const addLeader = async (db, kind, id, memberId) => {
  if (!memberId) return;
  const scopeName = types[kind].table;

  // A subdistrict assignment supersedes any unit-level leadership held by the
  // same person. This keeps both the Member Management and Subdistrict flows
  // consistent and prevents overlapping authorization scopes.
  if (kind === 'subdistrict') {
    await db.execute(`
      UPDATE Leadership leadership
      INNER JOIN ScopeType scopeType
        ON scopeType.ScopeTypeID = leadership.ScopeTypeID
      SET leadership.IsActiveLeader = FALSE
      WHERE leadership.MemberID = ?
        AND leadership.IsActiveLeader = TRUE
        AND scopeType.ScopeName = 'Unit'
    `, [Number(memberId)]);
  }

  await db.execute(`
    INSERT INTO Leadership (MemberID, ScopeTypeID, ScopeID, LeadershipType, IsActiveLeader, AssignedDate)
    SELECT ?, st.ScopeTypeID, ?, 'Leader', TRUE, CURDATE()
    FROM ScopeType st
    WHERE st.ScopeName = ? AND NOT EXISTS (
      SELECT 1 FROM Leadership existing
      WHERE existing.MemberID = ? AND existing.ScopeTypeID = st.ScopeTypeID
        AND existing.ScopeID = ? AND existing.IsActiveLeader = TRUE
    )
  `, [Number(memberId), Number(id), scopeName, Number(memberId), Number(id)]);

  // A unit leader may remain in a life group within the unit they lead. Remove
  // only a membership that belongs to a different unit, so it cannot become an
  // accidental second source of permission scope.
  if (kind === 'unit') {
    await db.execute(
      `UPDATE Member
       SET LifeGroupID = NULL
       WHERE MemberID = ?
         AND LifeGroupID IS NOT NULL
         AND LifeGroupID NOT IN (
           SELECT LifeGroupID FROM LifeGroup WHERE UnitID = ?
         )`,
      [Number(memberId), Number(id)]
    );
  }
  if (kind === 'subdistrict') {
    await db.execute(
      `UPDATE Member
       SET LifeGroupID = NULL
       WHERE MemberID = ?
         AND LifeGroupID IS NOT NULL
         AND LifeGroupID NOT IN (
           SELECT lg.LifeGroupID
           FROM LifeGroup lg
           INNER JOIN Unit u ON u.UnitID = lg.UnitID
           WHERE u.SubdistrictID = ?
         )`,
      [Number(memberId), Number(id)]
    );
  }
};

const assertAccessible = async (kind, id, user, db = pool, lock = false) => {
  if (!Number.isSafeInteger(id) || id <= 0) throw Object.assign(new Error('Invalid record ID'), { status: 400 });
  const [state] = await getStates(kind, [id], db, user, lock);
  if (!state) throw Object.assign(new Error('Record not found or outside your scope'), { status: 404 });
  return state;
};

const setStatus = async (kind, id, user, active) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await assertAccessible(kind, id, user, conn, true);
    const t = types[kind];
    // Deliberately update only this record; children and member assignments are preserved.
    await conn.execute(`UPDATE ${t.table} SET IsActive = ? WHERE ${t.id} = ?`, [active, id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally { conn.release(); }
};

const getChildren = async (kind, id) => {
  if (kind === 'group') return [];
  const [rows] = await pool.execute(kind === 'unit'
    ? 'SELECT LifeGroupID AS id, LifeGroupName AS name, IsActive FROM LifeGroup WHERE UnitID = ? ORDER BY LifeGroupName'
    : 'SELECT UnitID AS id, UnitName AS name, IsActive FROM Unit WHERE SubdistrictID = ? ORDER BY UnitName', [id]);
  return rows;
};

const assertUsable = async (kind, id, db = pool) => {
  const [state] = await getStates(kind, [Number(id)], db, null, true);
  if (!state || !Number(state.IsUsable)) throw Object.assign(new Error(state?.UnusableReason
    ? `This structure is unavailable because ${state.UnusableReason}`
    : 'This structure is inactive or has an inactive or missing parent'), { status: 400 });
};

/**
 * Resolve an active leader's authoritative organizational assignment.
 * Consumers should use this instead of inferring leadership scope from the
 * member's own life-group membership.
 */
const getMemberLeadershipScope = async (memberId, scope, db = pool) => {
  const scopeNames = {
    subdistrict: 'Subdistrict',
    unit: 'Unit',
    lifeGroup: 'LifeGroup',
  };
  const scopeName = scopeNames[scope];
  if (!scopeName) return null;

  const [rows] = await db.execute(`
    SELECT
      CASE WHEN st.ScopeName = 'LifeGroup' THEN l.ScopeID END AS lifeGroupId,
      CASE
        WHEN st.ScopeName = 'Unit' THEN l.ScopeID
        WHEN st.ScopeName = 'LifeGroup' THEN scopedGroup.UnitID
      END AS unitId,
      CASE
        WHEN st.ScopeName = 'Subdistrict' THEN l.ScopeID
        WHEN st.ScopeName = 'Unit' THEN scopedUnit.SubdistrictID
        WHEN st.ScopeName = 'LifeGroup' THEN groupUnit.SubdistrictID
      END AS subdistrictId
    FROM Leadership l
    INNER JOIN ScopeType st ON st.ScopeTypeID = l.ScopeTypeID
    LEFT JOIN LifeGroup scopedGroup
      ON st.ScopeName = 'LifeGroup' AND scopedGroup.LifeGroupID = l.ScopeID
    LEFT JOIN Unit scopedUnit
      ON st.ScopeName = 'Unit' AND scopedUnit.UnitID = l.ScopeID
    LEFT JOIN Unit groupUnit
      ON st.ScopeName = 'LifeGroup' AND groupUnit.UnitID = scopedGroup.UnitID
    WHERE l.MemberID = ?
      AND l.IsActiveLeader = TRUE
      AND st.ScopeName = ?
    ORDER BY l.LeadershipID
    LIMIT 1`,
  [Number(memberId), scopeName]);

  return rows[0] || null;
};

module.exports = {
  enrich,
  addLeader,
  assertAccessible,
  setStatus,
  getChildren,
  assertUsable,
  getStates,
  getMemberLeadershipScope,
};
