const { pool } = require('../config/db');

const DEFAULT_PASSWORD_KEY = 'member_bulk_import_password_hash';

const getDefaultPasswordHash = async (conn = pool) => {
  const [rows] = await conn.execute(
    'SELECT SettingValue FROM SystemSetting WHERE SettingKey = ?',
    [DEFAULT_PASSWORD_KEY]
  );
  return rows[0]?.SettingValue ?? null;
};

const getDefaultPasswordInfo = async () => {
  const [rows] = await pool.execute(
    'SELECT UpdatedAt FROM SystemSetting WHERE SettingKey = ?',
    [DEFAULT_PASSWORD_KEY]
  );
  return rows[0] ? { configured: true, updatedAt: rows[0].UpdatedAt } : { configured: false, updatedAt: null };
};

const setDefaultPasswordHash = async (passwordHash, userId) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const oldHash = await getDefaultPasswordHash(conn);
    if (oldHash) {
      // Members who changed their own password no longer match the shared hash
      // and are intentionally left untouched.
      await conn.execute(
        'UPDATE `User` SET PasswordHash = ? WHERE PasswordHash = ?',
        [passwordHash, oldHash]
      );
    }
    await conn.execute(
      `INSERT INTO SystemSetting (SettingKey, SettingValue, UpdatedByUserID)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         SettingValue = VALUES(SettingValue),
         UpdatedByUserID = VALUES(UpdatedByUserID),
         UpdatedAt = CURRENT_TIMESTAMP`,
      [DEFAULT_PASSWORD_KEY, passwordHash, userId]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const getExistingEmails = async (emails, conn = pool) => {
  if (!emails.length) return new Set();
  const placeholders = emails.map(() => '?').join(',');
  const [rows] = await conn.execute(
    `SELECT LOWER(Email) AS Email FROM Member WHERE LOWER(Email) IN (${placeholders})`,
    emails.map(email => email.toLowerCase())
  );
  return new Set(rows.map(row => row.Email));
};

const getLifeGroupsByName = async (names, scope = null, conn = pool) => {
  if (!names.length) return new Map();
  const placeholders = names.map(() => '?').join(',');
  const conditions = [
    `LOWER(lg.LifeGroupName) IN (${placeholders})`,
    'lg.IsActive = TRUE',
  ];
  const params = names.map(name => name.toLowerCase());

  if (scope?.type === 'subdistrict') {
    conditions.push('ut.SubdistrictID = ?');
    params.push(scope.id);
  } else if (scope?.type === 'unit') {
    conditions.push('lg.UnitID = ?');
    params.push(scope.id);
  } else if (scope?.type === 'lifeGroup') {
    conditions.push('lg.LifeGroupID = ?');
    params.push(scope.id);
  }

  const [rows] = await conn.execute(
    `SELECT lg.LifeGroupID, lg.LifeGroupName, lg.UnitID, ut.SubdistrictID
     FROM LifeGroup lg
     LEFT JOIN Unit ut ON ut.UnitID = lg.UnitID
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  const groups = new Map();
  for (const row of rows) {
    const key = row.LifeGroupName.trim().toLowerCase();
    const matches = groups.get(key) || [];
    matches.push({
      lifeGroupId: Number(row.LifeGroupID),
      unitId: Number(row.UnitID),
      subdistrictId: Number(row.SubdistrictID),
    });
    groups.set(key, matches);
  }
  return groups;
};

const importMembers = async (members) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const passwordHash = await getDefaultPasswordHash(conn);
    if (!passwordHash) {
      const err = new Error('Bulk import default password is not configured');
      err.statusCode = 409;
      throw err;
    }

    const imported = [];
    for (const member of members) {
      const [result] = await conn.execute(
        `INSERT INTO Member
          (FirstName, LastName, Email, Gender, BirthDate, MaritalStatus, JoinDate, MemberSince, LifeGroupID)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [member.firstName, member.lastName, member.email, member.gender,
          member.birthDate, member.maritalStatus, member.joinDate, member.memberSince, member.lifeGroupId]
      );
      const memberId = result.insertId;

      await conn.execute(
        `INSERT INTO MembershipStatus (MemberID, MembershipType, BelieverStatus)
         VALUES (?, ?, ?)`,
        [memberId, member.membershipType, member.believerStatus]
      );
      await conn.execute(
        `INSERT INTO MembershipActive (MemberID, IsActive) VALUES (?, TRUE)`,
        [memberId]
      );
      await conn.execute(
        `INSERT INTO MemberEngagement
          (MemberID, IsActiveEngage, IsActiveLifeGroup, IsActiveSundayService, IsActiveServing)
         VALUES (?, FALSE, FALSE, FALSE, FALSE)`,
        [memberId]
      );
      if (member.mobileNumber || member.landlineNumber) {
        await conn.execute(
          `INSERT INTO MemberPhone (MemberID, MobileNumber, LandlineNumber) VALUES (?, ?, ?)`,
          [memberId, member.mobileNumber, member.landlineNumber]
        );
      }
      await conn.execute(
        `INSERT INTO \`User\` (MemberID, PasswordHash, Role) VALUES (?, ?, ?)`,
        [memberId, passwordHash, member.role]
      );

      const leadershipScope = {
        subdistrict_leader: ['Subdistrict', member.subdistrictId, 'Leader'],
        unit_leader: ['Unit', member.unitId, 'Leader'],
        assistantunit_leader: ['Unit', member.unitId, 'Assistant Leader'],
        lg_leader: ['LifeGroup', member.lifeGroupId, 'Leader'],
        assistantlg_leader: ['LifeGroup', member.lifeGroupId, 'Assistant Leader'],
      }[member.role];

      if (leadershipScope) {
        const [scopeName, scopeId, leadershipType] = leadershipScope;
        await conn.execute(
          `INSERT INTO Leadership
             (MemberID, ScopeTypeID, ScopeID, LeadershipType, IsActiveLeader, AssignedDate)
           VALUES (?, (SELECT ScopeTypeID FROM ScopeType WHERE ScopeName = ? LIMIT 1), ?, ?, TRUE, CURDATE())`,
          [memberId, scopeName, scopeId, leadershipType]
        );
      }
      imported.push({ memberId, email: member.email });
    }

    await conn.commit();
    return imported;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  getDefaultPasswordHash,
  getDefaultPasswordInfo,
  setDefaultPasswordHash,
  getExistingEmails,
  getLifeGroupsByName,
  importMembers,
};
