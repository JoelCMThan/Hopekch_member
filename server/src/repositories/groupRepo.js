const organizationRepo = require('./organizationRepo');
const { pool } = require('../config/db');
const { buildGroupScopeClause, buildChurchMemberClause } = require('../utils/permissions');

const meetingLocation = (data) => {
  const invalid = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
  const fields = {};
  if (Object.hasOwn(data, 'groupAddress')) {
    if (data.groupAddress != null && typeof data.groupAddress !== 'string') invalid('Meeting address must be text');
    fields.MeetingAddress = data.groupAddress?.trim() || null;
    if (Buffer.byteLength(fields.MeetingAddress || '', 'utf8') > 65535) invalid('Meeting address is too long');
  }
  const hasLat = Object.hasOwn(data, 'latitude');
  const hasLng = Object.hasOwn(data, 'longitude');
  if (hasLat !== hasLng) invalid('Latitude and longitude must be provided together');
  if (hasLat) {
    const { latitude, longitude } = data;
    if ((latitude === null) !== (longitude === null)) invalid('Latitude and longitude must be provided together');
    if (latitude !== null && (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180)) {
      invalid('Invalid meeting coordinates');
    }
    fields.Latitude = latitude;
    fields.Longitude = longitude;
  } else if (Object.hasOwn(fields, 'MeetingAddress')) {
    // An address-only change must not retain coordinates for the previous address.
    fields.Latitude = null;
    fields.Longitude = null;
  }
  return fields;
};

/* ── leader join fragment ───────────────────────────────────
   ldr = Leadership row, lm = leader Member row      */
const LEADER_JOIN = `
  LEFT JOIN Leadership ldr
    ON  ldr.ScopeID       = g.LifeGroupID
    AND ldr.ScopeTypeID   = (SELECT ScopeTypeID FROM ScopeType WHERE ScopeName = 'LifeGroup' LIMIT 1)
    AND ldr.IsActiveLeader = TRUE
  LEFT JOIN Member lm ON lm.MemberID = ldr.MemberID
`;

/* ── upsert leader ─────────────────────────────────────────── */
const upsertGroupLeader = (conn, id, leaderMemberId) =>
  organizationRepo.addLeader(conn, 'group', id, leaderMemberId);

/* ── sync leader hierarchy ─────────────────────────────────── */
const syncLeaderHierarchy = async (conn, lifeGroupId, leaderMemberId) => {
  if (!leaderMemberId) return;

  await conn.execute(
    `UPDATE Member
     SET LifeGroupID = ?
     WHERE MemberID = ?`,
    [
      Number(lifeGroupId),
      Number(leaderMemberId)
    ]
  );
};

/* ── getGroups ─────────────────────────────────────────────── */
const getGroups = async ({ user, search, subdistrictId, unitId, page = 1, limit = 20, exportAll = false }) => {
  const offset = (page - 1) * limit;
  const scope  = buildGroupScopeClause(user);
  const conds  = ['1 = 1'];
  const params = [];

  if (search) {
    conds.push('(g.LifeGroupName LIKE ? OR u.UnitName LIKE ? OR lm.FirstName LIKE ? OR lm.LastName LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  if (subdistrictId) {
    conds.push('u.SubdistrictID = ?');
    params.push(Number(subdistrictId));
  }

  if (unitId) {
    conds.push('g.UnitID = ?');
    params.push(Number(unitId));
  }

  const where     = `WHERE ${conds.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  const dataSQL = `
    SELECT g.LifeGroupID, g.LifeGroupName, g.UnitID,
           u.UnitName, u.SubdistrictID, sd.SubdistrictName,
           MIN(lm.MemberID) AS MemberID, MIN(lm.FirstName) AS FirstName, MIN(lm.LastName) AS LastName,
           COUNT(DISTINCT mem.MemberID) AS MemberCount
    FROM LifeGroup g
    LEFT JOIN Unit u         ON u.UnitID = g.UnitID
    LEFT JOIN Subdistrict sd ON sd.SubdistrictID = u.SubdistrictID
    ${LEADER_JOIN}
    LEFT JOIN Member mem     ON mem.LifeGroupID = g.LifeGroupID
      AND ${buildChurchMemberClause('mem')}
    ${where}
    GROUP BY g.LifeGroupID, g.LifeGroupName, g.UnitID,
             u.UnitName, u.SubdistrictID, sd.SubdistrictName
    ORDER BY g.LifeGroupName
    ${exportAll ? '' : 'LIMIT ? OFFSET ?'}`;

  const countSQL = `
    SELECT COUNT(DISTINCT g.LifeGroupID) AS total
    FROM LifeGroup g
    LEFT JOIN Unit u         ON u.UnitID = g.UnitID
    LEFT JOIN Subdistrict sd ON sd.SubdistrictID = u.SubdistrictID
    ${LEADER_JOIN}
    ${where}`;

  const [rows]      = await pool.execute(dataSQL, exportAll ? allParams : [...allParams, limit, offset]);
  const [countRows] = await pool.execute(countSQL, allParams);

  return {
    groups:     await organizationRepo.enrich('group', rows),
    total:      countRows[0]?.total ?? 0,
    page,
    limit,
    totalPages: Math.ceil((countRows[0]?.total ?? 0) / limit),
  };
};

/* ── getGroupById ────────────────────────────────────────── */
const getGroupById = async (groupId) => {
  const [rows] = await pool.execute(`
    SELECT g.LifeGroupID, g.LifeGroupName, g.UnitID,
           u.UnitName, u.SubdistrictID, sd.SubdistrictName,
           MIN(lm.MemberID) AS MemberID, MIN(lm.FirstName) AS FirstName, MIN(lm.LastName) AS LastName, MIN(lm.Email) AS Email,
           COUNT(DISTINCT mem.MemberID) AS MemberCount
    FROM LifeGroup g
    LEFT JOIN Unit u         ON u.UnitID = g.UnitID
    LEFT JOIN Subdistrict sd ON sd.SubdistrictID = u.SubdistrictID
    ${LEADER_JOIN}
    LEFT JOIN Member mem     ON mem.LifeGroupID = g.LifeGroupID
      AND ${buildChurchMemberClause('mem')}
    WHERE g.LifeGroupID = ?
    GROUP BY g.LifeGroupID, g.LifeGroupName, g.UnitID,
             u.UnitName, u.SubdistrictID, sd.SubdistrictName`,
    [groupId]
  );
  return rows[0] ? (await organizationRepo.enrich('group', [rows[0]]))[0] : null;
};

/* ── createGroup ─────────────────────────────────────────── */
const createGroup = async (data) => {
  const location = meetingLocation(data);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      groupName,
      unitId,
      leaderMemberId = null,
    } = data;

    const [result] = await conn.execute(
      `INSERT INTO LifeGroup (LifeGroupName, UnitID, MeetingAddress, Latitude, Longitude) VALUES (?, ?, ?, ?, ?)`,
      [groupName, Number(unitId), location.MeetingAddress ?? null, location.Latitude ?? null, location.Longitude ?? null]
    );

    const newGroupId = result.insertId;

    // assign LifeGroup leader
    await upsertGroupLeader(conn, newGroupId, leaderMemberId);

    // sync leader hierarchy
    await syncLeaderHierarchy(conn, newGroupId, leaderMemberId);

    await conn.commit();
    return getGroupById(newGroupId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ── updateGroup ─────────────────────────────────────────── */
const updateGroup = async (groupId, data) => {
  const location = meetingLocation(data);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      groupName,
      unitId,
      leaderMemberId = null,
    } = data;

    const locationFields = Object.keys(location);
    await conn.execute(
      `UPDATE LifeGroup SET LifeGroupName = ?, UnitID = ?${locationFields.map((field) => `, ${field} = ?`).join('')} WHERE LifeGroupID = ?`,
      [groupName, Number(unitId), ...Object.values(location), groupId]
    );

    // update active leader
    await upsertGroupLeader(conn, groupId, leaderMemberId);

    // sync leader hierarchy
    await syncLeaderHierarchy(conn, groupId, leaderMemberId);

    await conn.commit();
    return getGroupById(groupId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ── deleteGroup ─────────────────────────────────────────── */
const deleteGroup = async (groupId) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Detach members from this group
    await conn.execute(
      `UPDATE Member SET LifeGroupID = NULL WHERE LifeGroupID = ?`,
      [groupId]
    );

    // deactivate leadership
    await conn.execute(
      `UPDATE Leadership
       SET IsActiveLeader = FALSE
       WHERE ScopeID     = ?
         AND ScopeTypeID = (SELECT ScopeTypeID FROM ScopeType WHERE ScopeName = 'LifeGroup' LIMIT 1)`,
      [groupId]
    );

    await conn.execute(
      `DELETE FROM LifeGroup WHERE LifeGroupID = ?`,
      [groupId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ── splitGroup ────────────────────────────────────────────── */
const splitGroup = async (groupId, data) => {
  const location = meetingLocation(data);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await organizationRepo.assertUsable('group', groupId, conn);

    const {
      newGroupName,
      memberIds = [],
      leaderMemberId = null,
    } = data;

    const [[original]] = await conn.execute(
      `SELECT UnitID FROM LifeGroup WHERE LifeGroupID = ?`,
      [groupId]
    );

    if (!original) {
      throw new Error('Original group not found');
    }

    const [result] = await conn.execute(
      `INSERT INTO LifeGroup (LifeGroupName, UnitID, MeetingAddress, Latitude, Longitude)
       VALUES (?, ?, ?, ?, ?)`,
      [
        newGroupName,
        original.UnitID,
        location.MeetingAddress ?? null,
        location.Latitude ?? null,
        location.Longitude ?? null,
      ]
    );

    const newGroupId = result.insertId;

    // move selected members
    if (memberIds.length > 0) {
      for (const memberId of memberIds) {
        await conn.execute(
          `UPDATE Member SET LifeGroupID = ? WHERE MemberID = ? AND LifeGroupID = ?`,
          [newGroupId, Number(memberId), groupId]
        );
      }
    }

    // assign leader
    await upsertGroupLeader(conn, newGroupId, leaderMemberId);

    // sync leader hierarchy
    await syncLeaderHierarchy(conn, newGroupId, leaderMemberId);

    await conn.commit();

    return {
      originalGroup: await getGroupById(groupId),
      newGroup:      await getGroupById(newGroupId)
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ── getGroupMembers ─────────────────────────────────────── */
const getGroupMembers = async (groupId) => {
  const [rows] = await pool.execute(`
    SELECT m.MemberID, m.FirstName, m.LastName, m.Email, m.Gender,
           ph.MobileNumber
    FROM Member m
    LEFT JOIN MemberPhone ph ON ph.MemberID = m.MemberID
    WHERE m.LifeGroupID = ?
    ORDER BY m.LastName, m.FirstName`,
    [groupId]
  );
  return rows;
};

/* ── getUnitsForGroups ───────────────────────────────────── */
const getUnitsForGroups = async () => {
  const [rows] = await pool.execute(`
    SELECT DISTINCT u.UnitID, u.UnitName,
                    sd.SubdistrictID, sd.SubdistrictName
    FROM Unit u
    LEFT JOIN Subdistrict sd ON sd.SubdistrictID = u.SubdistrictID
    ORDER BY u.UnitName`
  );
  return rows;
};

module.exports = {
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  splitGroup,
  getGroupMembers,
  getUnitsForGroups,
};
