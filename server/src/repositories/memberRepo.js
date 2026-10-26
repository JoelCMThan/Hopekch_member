const { prepareAssignment } = require('./memberAssignment');
/**
 * server/src/repositories/memberRepo.js
 */

const { pool } = require('../config/db');
const { ROLES, buildScopeClause, buildChurchMemberClause } = require('../utils/permissions');

// A leader can belong to a Unit/Subdistrict without belonging to a Life Group.
// Use one active assignment so historical leadership rows cannot duplicate members.
const MEMBER_LEADERSHIP_JOINS = `
    LEFT JOIN Leadership assignment ON assignment.LeadershipID = (
      SELECT MAX(currentLeadership.LeadershipID)
      FROM Leadership currentLeadership
      WHERE currentLeadership.MemberID = m.MemberID
        AND currentLeadership.IsActiveLeader = TRUE
    )
    LEFT JOIN ScopeType assignmentType ON assignmentType.ScopeTypeID = assignment.ScopeTypeID
    LEFT JOIN LifeGroup assignedGroup
      ON assignmentType.ScopeName = 'LifeGroup' AND assignedGroup.LifeGroupID = assignment.ScopeID
    LEFT JOIN Unit assignedUnit ON assignedUnit.UnitID = CASE
      WHEN assignmentType.ScopeName = 'Unit' THEN assignment.ScopeID
      WHEN assignmentType.ScopeName = 'LifeGroup' THEN assignedGroup.UnitID
    END
    LEFT JOIN Subdistrict assignedSubdistrict ON assignedSubdistrict.SubdistrictID = CASE
      WHEN assignmentType.ScopeName = 'Subdistrict' THEN assignment.ScopeID
      ELSE assignedUnit.SubdistrictID
    END
`;


/* ── getMembers ───────────────────────────────────────────── */
const getMembers = async ({ user, search, membershipType, membershipStatus, role, gender, subdistrictId, unitId, lifeGroupId, page = 1, limit = 20, exportAll = false }) => {
  const offset = (page - 1) * limit;
  const scope  = buildScopeClause(user);
  const conds  = [buildChurchMemberClause('m')];
  const params = [];

  if (search)         { conds.push('(m.FirstName LIKE ? OR m.LastName LIKE ? OR m.Email LIKE ?)'); const s=`%${search}%`; params.push(s,s,s); }
  if (membershipType) { conds.push('ms.MembershipType = ?'); params.push(membershipType); }
  if (membershipStatus === 'active')   { conds.push('COALESCE(msa.IsActive, TRUE) = TRUE'); }
  if (membershipStatus === 'inactive') { conds.push('msa.IsActive = FALSE'); }
  if (role)           { conds.push('usr.Role = ?');          params.push(role); }
  if (gender)         { conds.push('m.Gender = ?');         params.push(gender); }
  if (subdistrictId)  { conds.push('COALESCE(ut.SubdistrictID, assignedSubdistrict.SubdistrictID) = ?'); params.push(Number(subdistrictId)); }
  if (unitId)         { conds.push('COALESCE(ut.UnitID, assignedUnit.UnitID) = ?'); params.push(Number(unitId)); }
  if (lifeGroupId)    { conds.push('m.LifeGroupID = ?');    params.push(Number(lifeGroupId)); }

  const where     = `WHERE ${conds.join(' AND ')} ${scope.clause}`;
  const allParams = [...params, ...scope.params];

  const dataSQL = `
    SELECT m.MemberID, m.FirstName, m.LastName, m.Gender, m.BirthDate,
           m.MaritalStatus, m.Email,
           COALESCE(ms.MembershipType, 'Member') AS MembershipType,
           ms.BelieverStatus,
           m.JoinDate, m.MemberSince, m.LifeGroupID,
           lg.LifeGroupName,
           COALESCE(lg.UnitID, assignedUnit.UnitID) AS UnitID,
           COALESCE(ut.UnitName, assignedUnit.UnitName) AS UnitName,
           COALESCE(ut.SubdistrictID, assignedSubdistrict.SubdistrictID) AS SubdistrictID,
           COALESCE(sd.SubdistrictName, assignedSubdistrict.SubdistrictName) AS SubdistrictName,
           ph.MobileNumber, ph.LandlineNumber,
           a.StreetAddress, a.City, a.State, a.PostalCode, a.Country,
           CASE WHEN b.MemberID IS NOT NULL THEN TRUE ELSE FALSE END AS isBaptized,
           b.BaptismDate, b.Venue AS BaptismVenue, b.Remarks AS BaptismRemarks,
           usr.Role,
           COALESCE(msa.IsActive, TRUE)                AS MembershipIsActive,
           msa.InactiveReason,
           msa.AdditionalNotes AS InactiveNotes,
           COALESCE(me.IsActiveEngage, FALSE)         AS IsActiveEngage,
           COALESCE(me.IsActiveLifeGroup, FALSE)      AS IsActiveLifeGroup,
           COALESCE(me.IsActiveSundayService, FALSE)  AS IsActiveSundayService,
           COALESCE(me.IsActiveServing, FALSE)        AS IsActiveServing
    FROM Member m
    LEFT JOIN MembershipStatus ms ON ms.MemberID = m.MemberID
    LEFT JOIN LifeGroup lg  ON lg.LifeGroupID = m.LifeGroupID
    LEFT JOIN Unit ut       ON ut.UnitID = lg.UnitID
    LEFT JOIN Subdistrict sd ON sd.SubdistrictID = ut.SubdistrictID
    ${MEMBER_LEADERSHIP_JOINS}
    LEFT JOIN MemberPhone ph ON ph.MemberID = m.MemberID
    LEFT JOIN Address a     ON a.MemberID = m.MemberID
    LEFT JOIN Baptism b     ON b.MemberID = m.MemberID
    LEFT JOIN \`User\` usr  ON usr.MemberID = m.MemberID
    LEFT JOIN MembershipActive msa ON msa.MemberID = m.MemberID
    LEFT JOIN MemberEngagement me ON me.MemberID = m.MemberID
    ${where}
    ORDER BY m.LastName, m.FirstName
    ${exportAll ? '' : 'LIMIT ? OFFSET ?'}`;

  const countSQL = `
    SELECT COUNT(*) AS total
    FROM Member m    LEFT JOIN MembershipStatus ms ON ms.MemberID = m.MemberID    LEFT JOIN LifeGroup lg ON lg.LifeGroupID = m.LifeGroupID
    LEFT JOIN Unit ut      ON ut.UnitID = lg.UnitID
    ${MEMBER_LEADERSHIP_JOINS}
    LEFT JOIN \`User\` usr ON usr.MemberID = m.MemberID
    LEFT JOIN MembershipActive msa ON msa.MemberID = m.MemberID
    ${where}`;

  const [rows]      = await pool.execute(dataSQL, exportAll ? allParams : [...allParams, limit, offset]);
  const [countRows] = await pool.execute(countSQL, allParams);

  return {
    members:    rows,
    total:      countRows[0]?.total ?? 0,
    page, limit,
    totalPages: Math.ceil((countRows[0]?.total ?? 0) / limit),
  };
};

/* ── getMemberById through leadership table for leaders────────────────────── */
const getMemberById = async (memberId) => {
  const [rows] = await pool.execute(`
    SELECT
      m.MemberID, m.FirstName, m.LastName, m.Gender, m.BirthDate,
      m.MaritalStatus, m.Email,
      COALESCE(ms.MembershipType, 'Member') AS MembershipType,
      ms.BelieverStatus, m.JoinDate, m.MemberSince,

      /* Member's normal grouping */
      lg.UnitID AS MemberUnitID, ut.UnitName AS MemberUnitName,
      ut.SubdistrictID AS MemberSubdistrictID,
      sd.SubdistrictName AS MemberSubdistrictName,

      /* Leadership */
      st.ScopeName AS LeadershipScopeType,
      l.ScopeID AS LeadershipScopeID,

      /* Final grouping returned to frontend */
      CASE
        WHEN st.ScopeName = 'LifeGroup' THEN leaderLg.LifeGroupID
        ELSE lg.LifeGroupID
      END AS LifeGroupID,

      CASE
        WHEN st.ScopeName = 'LifeGroup' THEN leaderLg.LifeGroupName
        ELSE lg.LifeGroupName
      END AS LifeGroupName,

      CASE
        WHEN st.ScopeName = 'LifeGroup' THEN leaderLg.UnitID
        WHEN st.ScopeName = 'Unit' THEN leaderUt.UnitID
        ELSE lg.UnitID
      END AS UnitID,

      CASE
        WHEN st.ScopeName = 'LifeGroup' THEN leaderLgUnit.UnitName
        WHEN st.ScopeName = 'Unit' THEN leaderUt.UnitName
        ELSE ut.UnitName
      END AS UnitName,

      CASE
        WHEN st.ScopeName = 'LifeGroup' THEN leaderLgUnit.SubdistrictID
        WHEN st.ScopeName = 'Unit' THEN leaderUt.SubdistrictID
        WHEN st.ScopeName = 'Subdistrict' THEN leaderSd.SubdistrictID
        ELSE ut.SubdistrictID
      END AS SubdistrictID,

      CASE
        WHEN st.ScopeName = 'LifeGroup' THEN leaderLgSd.SubdistrictName
        WHEN st.ScopeName = 'Unit' THEN leaderUnitSd.SubdistrictName
        WHEN st.ScopeName = 'Subdistrict' THEN leaderSd.SubdistrictName
        ELSE sd.SubdistrictName
      END AS SubdistrictName,

      ph.MobileNumber, ph.LandlineNumber,
      a.StreetAddress, a.City, a.State, a.PostalCode, a.Country,
      CASE WHEN b.MemberID IS NOT NULL THEN TRUE ELSE FALSE END AS isBaptized,
      b.BaptismDate, b.Venue AS BaptismVenue, b.Remarks AS BaptismRemarks,
      usr.Role, usr.UserID, usr.CreatedAt AS AccountCreatedAt,

      COALESCE(msa.IsActive, TRUE) AS MembershipIsActive,
      msa.InactiveReason, msa.AdditionalNotes AS InactiveNotes,
      COALESCE(me.IsActiveEngage, FALSE) AS IsActiveEngage,
      COALESCE(me.IsActiveLifeGroup, FALSE) AS IsActiveLifeGroup,
      COALESCE(me.IsActiveSundayService, FALSE) AS IsActiveSundayService,
      COALESCE(me.IsActiveServing, FALSE) AS IsActiveServing

    FROM Member m
    LEFT JOIN MembershipStatus ms ON ms.MemberID = m.MemberID

    /* Member's own grouping */
    LEFT JOIN LifeGroup lg ON lg.LifeGroupID = m.LifeGroupID
    LEFT JOIN Unit ut ON ut.UnitID = lg.UnitID
    LEFT JOIN Subdistrict sd ON sd.SubdistrictID = ut.SubdistrictID

    /* Active leadership */
    LEFT JOIN Leadership l ON l.MemberID = m.MemberID AND l.IsActiveLeader = TRUE
    LEFT JOIN ScopeType st ON st.ScopeTypeID = l.ScopeTypeID

    /* Life Group leadership */
    LEFT JOIN LifeGroup leaderLg
      ON st.ScopeName = 'LifeGroup' AND leaderLg.LifeGroupID = l.ScopeID
    LEFT JOIN Unit leaderLgUnit ON leaderLgUnit.UnitID = leaderLg.UnitID
    LEFT JOIN Subdistrict leaderLgSd
      ON leaderLgSd.SubdistrictID = leaderLgUnit.SubdistrictID

    /* Unit leadership */
    LEFT JOIN Unit leaderUt
      ON st.ScopeName = 'Unit' AND leaderUt.UnitID = l.ScopeID
    LEFT JOIN Subdistrict leaderUnitSd
      ON leaderUnitSd.SubdistrictID = leaderUt.SubdistrictID

    /* Subdistrict leadership */
    LEFT JOIN Subdistrict leaderSd
      ON st.ScopeName = 'Subdistrict' AND leaderSd.SubdistrictID = l.ScopeID

    LEFT JOIN MemberPhone ph ON ph.MemberID = m.MemberID
    LEFT JOIN Address a ON a.MemberID = m.MemberID
    LEFT JOIN Baptism b ON b.MemberID = m.MemberID
    LEFT JOIN \`User\` usr ON usr.MemberID = m.MemberID
    LEFT JOIN MembershipActive msa ON msa.MemberID = m.MemberID
    LEFT JOIN MemberEngagement me ON me.MemberID = m.MemberID

    WHERE m.MemberID = ?
      AND ${buildChurchMemberClause('m')}
  `, [memberId]);

  return rows[0] ?? null;
};

/* ── upsert membership and engagement status ───────────────── */
const upsertMemberStatus = async (
  memberId,
  {
    membershipIsActive = true,
    isActiveEngage = false,
    isActiveLifeGroup = false,
    isActiveSundayService = false,
    isActiveServing = false,
  } = {},
  conn = pool
) => {
  await conn.execute(
    `INSERT INTO MembershipActive (MemberID, IsActive)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE IsActive = VALUES(IsActive)`,
    [memberId, membershipIsActive]
  );

  await conn.execute(
    `INSERT INTO MemberEngagement
       (MemberID, IsActiveEngage, IsActiveLifeGroup, IsActiveSundayService, IsActiveServing)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       IsActiveEngage = VALUES(IsActiveEngage),
       IsActiveLifeGroup = VALUES(IsActiveLifeGroup),
       IsActiveSundayService = VALUES(IsActiveSundayService),
       IsActiveServing = VALUES(IsActiveServing)`,
    [memberId, isActiveEngage, isActiveLifeGroup, isActiveSundayService, isActiveServing]
  );
};

const syncLeaderAssignment = async (
  conn,
  memberId,
  { role, subdistrictId = null, unitId = null, lifeGroupId = null } = {}
) => {
  let resolvedUnitId = unitId ? Number(unitId) : null;
  let resolvedSubdistrictId = subdistrictId ? Number(subdistrictId) : null;
  const resolvedLifeGroupId = lifeGroupId ? Number(lifeGroupId) : null;

  if (resolvedLifeGroupId) {
    const [[group]] = await conn.query(
      'SELECT UnitID FROM LifeGroup WHERE LifeGroupID = ?',
      [resolvedLifeGroupId]
    );
    resolvedUnitId = group?.UnitID ?? resolvedUnitId;
  }

  if (resolvedUnitId) {
    const [[unit]] = await conn.query(
      'SELECT SubdistrictID FROM Unit WHERE UnitID = ?',
      [resolvedUnitId]
    );
    resolvedSubdistrictId = unit?.SubdistrictID ?? resolvedSubdistrictId;
  }

  if (
    resolvedUnitId &&
    [ROLES.UNIT_LEADER, ROLES.ASSISTANT_UNIT_LEADER].includes(role)
  ) {
    await conn.execute(
      `UPDATE Member
       SET LifeGroupID = NULL
       WHERE MemberID = ?
         AND LifeGroupID IS NOT NULL
         AND LifeGroupID NOT IN (
           SELECT LifeGroupID FROM LifeGroup WHERE UnitID = ?
         )`,
      [memberId, resolvedUnitId]
    );
  }
  if (role === ROLES.SUBDISTRICT_LEADER && resolvedSubdistrictId) {
    await conn.execute(
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
      [memberId, resolvedSubdistrictId]
    );
  }

  await conn.execute(
    'UPDATE Leadership SET IsActiveLeader = FALSE WHERE MemberID = ? AND IsActiveLeader = TRUE',
    [memberId]
  );

  let scopeName = null;
  let scopeId = null;
  if (role === ROLES.SUBDISTRICT_LEADER && resolvedSubdistrictId) {
    scopeName = 'Subdistrict';
    scopeId = resolvedSubdistrictId;
  } else if (
    [ROLES.UNIT_LEADER, ROLES.ASSISTANT_UNIT_LEADER].includes(role) &&
    resolvedUnitId
  ) {
    scopeName = 'Unit';
    scopeId = resolvedUnitId;
  } else if (
    [ROLES.LG_LEADER, ROLES.ASSISTANT_LG_LEADER].includes(role) &&
    resolvedLifeGroupId
  ) {
    scopeName = 'LifeGroup';
    scopeId = resolvedLifeGroupId;
  }

  if (!scopeId) return;

  await conn.execute(
    `INSERT INTO Leadership
       (MemberID, ScopeTypeID, ScopeID, LeadershipType, IsActiveLeader, AssignedDate)
     VALUES (?, (SELECT ScopeTypeID FROM ScopeType WHERE ScopeName = ? LIMIT 1), ?, ?, TRUE, CURDATE())`,
    [memberId, scopeName, scopeId,
      [ROLES.ASSISTANT_UNIT_LEADER, ROLES.ASSISTANT_LG_LEADER].includes(role) ? 'Assistant Leader' : 'Leader']
  );
};

/* ── createMember ─────────────────────────────────────────── */
const insertMembershipStatus = async (
  memberId,
  membershipType = 'Member',
  believerStatus = null,
  conn = pool
) => {
  const normalizedBelieverStatus = membershipType === 'Member' ? null : believerStatus;

  await conn.execute(
    `INSERT INTO MembershipStatus (MemberID, MembershipType, BelieverStatus)
     VALUES (?, ?, ?)`,
    [memberId, membershipType, normalizedBelieverStatus]
  );
};

const createMember = async (data) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await prepareAssignment(conn, data);

    const {
      firstName, lastName, email,
      gender = null, birthDate = null, maritalStatus = null,
      membershipType = 'Member', believerStatus = null, joinDate = null, memberSince = null, lifeGroupId = null,
      mobileNumber = null, landlineNumber = null,
      // Address
      streetAddress = null, city = null, state = null,
      postalCode = null, country = null,
      // Baptism
      isBaptized = false, baptismDate = null,
      baptismVenue = null, baptismRemarks = null,
      // Membership and engagement status
      membershipIsActive = true, isActiveEngage = false, isActiveLifeGroup = false,
      isActiveSundayService = false, isActiveServing = false,
      // User account
      passwordHash = null, role = 'member',
      subdistrictId = null, unitId = null,
    } = data;

    const [result] = await conn.execute(
      `INSERT INTO Member (FirstName,LastName,Email,Gender,BirthDate,MaritalStatus,JoinDate,MemberSince,LifeGroupID)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [firstName, lastName, email, gender, birthDate, maritalStatus, joinDate, memberSince, lifeGroupId]
    );
    const newId = result.insertId;

    await insertMembershipStatus(newId, membershipType, believerStatus, conn);

    if (mobileNumber || landlineNumber) {
      await conn.execute(
        `INSERT INTO MemberPhone (MemberID,MobileNumber,LandlineNumber) VALUES (?,?,?)`,
        [newId, mobileNumber, landlineNumber]
      );
    }

    if (streetAddress || city || state || postalCode || country) {
      await conn.execute(
        `INSERT INTO Address (MemberID,StreetAddress,City,State,PostalCode,Country) VALUES (?,?,?,?,?,?)`,
        [newId, streetAddress, city, state, postalCode, country]
      );
    }

    if (isBaptized) {
      await conn.execute(
        `INSERT INTO Baptism (MemberID,BaptismDate,Venue,Remarks) VALUES (?,?,?,?)`,
        [newId, baptismDate, baptismVenue, baptismRemarks]
      );
    }

    await upsertMemberStatus(newId, { membershipIsActive, isActiveEngage, isActiveLifeGroup, isActiveSundayService, isActiveServing }, conn);
    await syncLeaderAssignment(conn, newId, { role, subdistrictId, unitId, lifeGroupId });

    // Create user account if password hash is provided
    if (passwordHash) {
      await conn.execute(
        `INSERT INTO \`User\` (MemberID, PasswordHash, Role) VALUES (?, ?, ?)`,
        [newId, passwordHash, role]
      );
    }

    await conn.commit();
    return getMemberById(newId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ── updateMember ─────────────────────────────────────────── */
const updateMembershipStatus = async (
  memberId,
  membershipType = 'Member',
  believerStatus = null,
  conn = pool
) => {
  const normalizedBelieverStatus = membershipType === 'Member' ? null : believerStatus;

  const [rows] = await conn.execute(
    `SELECT MemberID FROM MembershipStatus WHERE MemberID = ?`,
    [memberId]
  );

  if (rows.length > 0) {
    await conn.execute(
      `UPDATE MembershipStatus
       SET MembershipType = ?, BelieverStatus = ?
       WHERE MemberID = ?`,
      [membershipType, normalizedBelieverStatus, memberId]
    );
  } else {
    await insertMembershipStatus(memberId, membershipType, believerStatus, conn);
  }
};

const updateMember = async (memberId, data) => {
  const {
    firstName, lastName, email,
    gender = null, birthDate = null, maritalStatus = null,
    membershipType = 'Member', believerStatus = null, joinDate = null, memberSince = null, lifeGroupId = null,
    mobileNumber = null, landlineNumber = null,
    streetAddress = null, city = null, state = null,
    postalCode = null, country = null,
    isBaptized = false, baptismDate = null,
    baptismVenue = null, baptismRemarks = null,
    // Membership and engagement status
    membershipIsActive = true, isActiveEngage = false, isActiveLifeGroup = false,
    isActiveSundayService = false, isActiveServing = false,
    // User role
    role = null,
    subdistrictId = null, unitId = null,
  } = data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const assignment = await prepareAssignment(conn, data, memberId);

    await conn.execute(
      `UPDATE Member SET FirstName=?,LastName=?,Email=?,Gender=?,BirthDate=?,
       MaritalStatus=?,JoinDate=?,MemberSince=?,LifeGroupID=? WHERE MemberID=?`,
      [firstName, lastName, email, gender, birthDate,
       maritalStatus, joinDate, memberSince, assignment.storedGroupId, memberId]
    );

    await updateMembershipStatus(memberId, membershipType, believerStatus, conn);

    // Phone
    const [ph] = await conn.execute(`SELECT MemberID FROM MemberPhone WHERE MemberID=?`, [memberId]);
    if (ph.length > 0) {
      await conn.execute(`UPDATE MemberPhone SET MobileNumber=?,LandlineNumber=? WHERE MemberID=?`,
        [mobileNumber, landlineNumber, memberId]);
    } else if (mobileNumber || landlineNumber) {
      await conn.execute(`INSERT INTO MemberPhone (MemberID,MobileNumber,LandlineNumber) VALUES (?,?,?)`,
        [memberId, mobileNumber, landlineNumber]);
    }

    // Address
    const [addr] = await conn.execute(`SELECT AddressID FROM Address WHERE MemberID=?`, [memberId]);
    if (addr.length > 0) {
      await conn.execute(
        `UPDATE Address SET StreetAddress=?,City=?,State=?,PostalCode=?,Country=? WHERE MemberID=?`,
        [streetAddress, city, state, postalCode, country, memberId]
      );
    } else if (streetAddress || city || state || postalCode || country) {
      await conn.execute(
        `INSERT INTO Address (MemberID,StreetAddress,City,State,PostalCode,Country) VALUES (?,?,?,?,?,?)`,
        [memberId, streetAddress, city, state, postalCode, country]
      );
    }

    // Baptism
    const [bap] = await conn.execute(`SELECT MemberID FROM Baptism WHERE MemberID=?`, [memberId]);
    if (!isBaptized) {
      if (bap.length > 0) await conn.execute(`DELETE FROM Baptism WHERE MemberID=?`, [memberId]);
    } else if (bap.length > 0) {
      await conn.execute(
        `UPDATE Baptism SET BaptismDate=?,Venue=?,Remarks=? WHERE MemberID=?`,
        [baptismDate, baptismVenue, baptismRemarks, memberId]
      );
    } else {
      await conn.execute(
        `INSERT INTO Baptism (MemberID,BaptismDate,Venue,Remarks) VALUES (?,?,?,?)`,
        [memberId, baptismDate, baptismVenue, baptismRemarks]
      );
    }

    const [[membershipStatus]] = await conn.query(
      'SELECT IsActive FROM MembershipActive WHERE MemberID = ?',
      [memberId]
    );
    await upsertMemberStatus(memberId, {
      membershipIsActive: membershipStatus?.IsActive ?? true,
      isActiveEngage,
      isActiveLifeGroup,
      isActiveSundayService,
      isActiveServing,
    }, conn);

    if (Object.hasOwn(data, 'membershipIsActive')) {
      const becomingInactive = !data.membershipIsActive && Boolean(membershipStatus?.IsActive ?? true);
      await conn.execute(
        `UPDATE MembershipActive SET IsActive = ?, InactiveReason = ?, AdditionalNotes = ?,
         DeactivatedByMemberID = CASE WHEN ? THEN NULL WHEN ? THEN ? ELSE DeactivatedByMemberID END,
         DeactivatedDate = CASE WHEN ? THEN NULL WHEN ? THEN NOW() ELSE DeactivatedDate END
         WHERE MemberID = ?`,
        [data.membershipIsActive,
          data.membershipIsActive ? null : data.inactiveReason,
          data.membershipIsActive ? null : data.inactiveNotes ?? null,
          data.membershipIsActive, becomingInactive, data.deactivatedByMemberId ?? null,
          data.membershipIsActive, becomingInactive, memberId]
      );
    }

    // Update user role if provided
    if (role !== null && role !== undefined) {
      const [userExists] = await conn.execute(
        `SELECT UserID FROM \`User\` WHERE MemberID = ?`,
        [memberId]
      );
      if (userExists.length > 0) {
        await conn.execute(
          `UPDATE \`User\` SET Role = ? WHERE MemberID = ?`,
          [role, memberId]
        );
      }
    }

    const [[currentUser]] = await conn.query(
      'SELECT Role FROM `User` WHERE MemberID = ?',
      [memberId]
    );
    if (assignment.changed) await syncLeaderAssignment(conn, memberId, {
      role: role ?? currentUser?.Role ?? 'member',
      ...assignment.scope,
    });

    await conn.commit();
    return getMemberById(memberId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ── deleteMember ─────────────────────────────────────────── */
const deleteMember = async (memberId) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // FK CASCADE handles Address, Baptism, MemberPhone, MembershipActive, MemberEngagement
    await conn.execute('DELETE FROM `User` WHERE MemberID=?', [memberId]);
    await conn.execute(`DELETE FROM Member WHERE MemberID=?`, [memberId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ── isMemberInScope ──────────────────────────────────────── */
const isMemberInScope = async (targetMemberId, user) => {
  const { role, memberId } = user;
  if (role === 'master_admin' || role === 'admin' || role === 'manager') return true;

  const scope = buildScopeClause(user);
  const [rows] = await pool.execute(
    `SELECT m.MemberID FROM Member m
     LEFT JOIN LifeGroup lg ON lg.LifeGroupID = m.LifeGroupID
     LEFT JOIN Unit ut      ON ut.UnitID = lg.UnitID
     LEFT JOIN \`User\` usr ON usr.MemberID = m.MemberID
     WHERE m.MemberID = ? ${scope.clause}`,
    [targetMemberId, ...scope.params]
  );
  return rows.length > 0;
};

/* ── getLifeGroups ────────────────────────────────────────── */
const getLifeGroups = async (unitId, subdistrictId, usableOnly = false) => {
  let sql  = `SELECT lg.LifeGroupID, lg.LifeGroupName, lg.UnitID, ut.SubdistrictID
    FROM LifeGroup lg
    LEFT JOIN Unit ut ON ut.UnitID = lg.UnitID LEFT JOIN Subdistrict sd ON sd.SubdistrictID = ut.SubdistrictID`;
  const args = [];
  const clauses = usableOnly ? ['lg.IsActive = TRUE AND ut.IsActive = TRUE AND sd.IsActive = TRUE'] : [];

  if (subdistrictId) { clauses.push('ut.SubdistrictID = ?'); args.push(Number(subdistrictId)); }
  if (unitId) { clauses.push('lg.UnitID = ?'); args.push(Number(unitId)); }

  if (clauses.length) {
    sql += ` WHERE ${clauses.join(' AND ')}`;
  }

  sql += ` ORDER BY lg.LifeGroupName`;
  const [rows] = await pool.execute(sql, args);
  return rows;
};

/* ── getUnits ─────────────────────────────────────────────── */
const getUnits = async (usableOnly = false) => {
  const [rows] = await pool.execute(
    `SELECT u.UnitID, u.UnitName, u.SubdistrictID FROM Unit u LEFT JOIN Subdistrict sd ON sd.SubdistrictID = u.SubdistrictID ${usableOnly ? 'WHERE u.IsActive = TRUE AND sd.IsActive = TRUE' : ''} ORDER BY u.UnitName`
  );
  return rows;
};

/* ── getSubdistricts ──────────────────────────────────────── */
const getSubdistricts = async (usableOnly = false) => {
  const [rows] = await pool.execute(
    `SELECT SubdistrictID, SubdistrictName FROM Subdistrict ${usableOnly ? 'WHERE IsActive = TRUE' : ''} ORDER BY SubdistrictName`
  );
  return rows;
};

/* ── setMemberPassword ────────────────────────────────────── */
const setMemberPassword = async (memberId, passwordHash, defaultRole = 'member') => {
  const [existing] = await pool.execute(
    `SELECT UserID FROM \`User\` WHERE MemberID = ?`, [memberId]
  );
  if (existing.length > 0) {
    await pool.execute(
      `UPDATE \`User\` SET PasswordHash = ? WHERE MemberID = ?`,
      [passwordHash, memberId]
    );
  } else {
    // Member has no account yet — create one with a default role
    await pool.execute(
      `INSERT INTO \`User\` (MemberID, PasswordHash, Role) VALUES (?, ?, ?)`,
      [memberId, passwordHash, defaultRole]
    );
  }
};

/* ── getMemberUserRole ─────────────────────────────────────── */
const getMemberUserRole = async (memberId) => {
  const [rows] = await pool.execute(
    `SELECT usr.Role FROM \`User\` usr WHERE usr.MemberID = ?`, [memberId]
  );
  return rows[0]?.Role ?? null;
};

module.exports = {
  MEMBER_LEADERSHIP_JOINS,
  getMembers, getMemberById,
  createMember, updateMember, deleteMember,
  isMemberInScope,
  setMemberPassword, getMemberUserRole,
  getLifeGroups, getUnits, getSubdistricts,
};
