/**
 * server/src/repositories/communicationRepo.js
 */

const { pool } = require('../config/db');
const { MEMBER_LEADERSHIP_JOINS } = require('./memberRepo');

const normalizeIds = (value) => {
  const values = Array.isArray(value) ? value : [value];

  return values
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
};

const addIdFilter = (conditions, params, column, value) => {
  const ids = normalizeIds(value);

  if (ids.length === 0) {
    return;
  }

  const placeholders = ids.map(() => '?').join(', ');
  conditions.push(
    ids.length === 1
      ? `${column} = ?`
      : `${column} IN (${placeholders})`
  );
  params.push(...ids);
};


/* ── getActiveMembers ─────────────────────────────────────── */

const getActiveMembers = async ({
  search = null,
  subdistrictId = null,
  unitId = null,
  lifeGroupId = null,
} = {}) => {
  const conds = [
    'COALESCE(ma.IsActive, TRUE) = TRUE',
    'm.Email IS NOT NULL',
    "TRIM(m.Email) <> ''",
  ];

  const params = [];

  if (search) {
    conds.push(`
      (
        m.FirstName LIKE ?
        OR m.LastName LIKE ?
        OR m.Email LIKE ?
      )
    `);

    const searchValue = `%${search}%`;

    params.push(
      searchValue,
      searchValue,
      searchValue
    );
  }

  addIdFilter(conds, params, 'COALESCE(ut.SubdistrictID, assignedSubdistrict.SubdistrictID)', subdistrictId);
  addIdFilter(conds, params, 'COALESCE(ut.UnitID, assignedUnit.UnitID)', unitId);
  addIdFilter(conds, params, 'm.LifeGroupID', lifeGroupId);

  const [rows] = await pool.execute(
    `
      SELECT
        m.MemberID,
        m.FirstName,
        m.LastName,
        m.Email,
        m.LifeGroupID,
        lg.LifeGroupName,
        COALESCE(lg.UnitID, assignedUnit.UnitID) AS UnitID,
        COALESCE(ut.UnitName, assignedUnit.UnitName) AS UnitName,
        COALESCE(ut.SubdistrictID, assignedSubdistrict.SubdistrictID) AS SubdistrictID,
        COALESCE(sd.SubdistrictName, assignedSubdistrict.SubdistrictName) AS SubdistrictName
      FROM Member m
      LEFT JOIN LifeGroup lg
        ON lg.LifeGroupID = m.LifeGroupID
      LEFT JOIN Unit ut
        ON ut.UnitID = lg.UnitID
      LEFT JOIN Subdistrict sd
        ON sd.SubdistrictID = ut.SubdistrictID
      ${MEMBER_LEADERSHIP_JOINS}
      LEFT JOIN MembershipActive ma
        ON ma.MemberID = m.MemberID
      WHERE ${conds.join(' AND ')}
      ORDER BY m.LastName, m.FirstName
    `,
    params
  );

  return rows;
};


/* ── getMembersByGroup ────────────────────────────────────── */

const getMembersByGroup = async (lifeGroupId) => {
  if (normalizeIds(lifeGroupId).length === 0) {
    return [];
  }

  return getActiveMembers({
    lifeGroupId,
  });
};


/* ── getMembersByUnit ─────────────────────────────────────── */

const getMembersByUnit = async (unitId) => {
  if (normalizeIds(unitId).length === 0) {
    return [];
  }

  return getActiveMembers({
    unitId,
  });
};


/* ── getMembersBySubdistrict ──────────────────────────────── */

const getMembersBySubdistrict = async (subdistrictId) => {
  if (normalizeIds(subdistrictId).length === 0) {
    return [];
  }

  return getActiveMembers({
    subdistrictId,
  });
};


/* ── getMembersByIds ──────────────────────────────────────── */

const getMembersByIds = async (memberIds = []) => {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return [];
  }

  const validIds = memberIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (validIds.length === 0) {
    return [];
  }

  const placeholders = validIds.map(() => '?').join(', ');

  const [rows] = await pool.execute(
    `
      SELECT
        m.MemberID,
        m.FirstName,
        m.LastName,
        m.Email,
        m.LifeGroupID,
        lg.LifeGroupName,
        COALESCE(lg.UnitID, assignedUnit.UnitID) AS UnitID,
        COALESCE(ut.UnitName, assignedUnit.UnitName) AS UnitName,
        COALESCE(ut.SubdistrictID, assignedSubdistrict.SubdistrictID) AS SubdistrictID,
        COALESCE(sd.SubdistrictName, assignedSubdistrict.SubdistrictName) AS SubdistrictName
      FROM Member m
      LEFT JOIN LifeGroup lg
        ON lg.LifeGroupID = m.LifeGroupID
      LEFT JOIN Unit ut
        ON ut.UnitID = lg.UnitID
      LEFT JOIN Subdistrict sd
        ON sd.SubdistrictID = ut.SubdistrictID
      ${MEMBER_LEADERSHIP_JOINS}
      LEFT JOIN MembershipActive ma
        ON ma.MemberID = m.MemberID
      WHERE m.MemberID IN (${placeholders})
        AND COALESCE(ma.IsActive, TRUE) = TRUE
        AND m.Email IS NOT NULL
        AND TRIM(m.Email) <> ''
      ORDER BY m.LastName, m.FirstName
    `,
    validIds
  );

  return rows;
};

/* ── getMembersByRoles ───────────────────────────────────── */

const getMembersByRoles = async (roles = []) => {
  if (!Array.isArray(roles) || roles.length === 0) {
    return [];
  }

  const validRoles = roles
    .map((role) => String(role).trim())
    .filter(Boolean);

  if (validRoles.length === 0) {
    return [];
  }

  const placeholders = validRoles
    .map(() => '?')
    .join(', ');

  const [rows] = await pool.execute(
    `
      SELECT DISTINCT
        m.MemberID,
        m.FirstName,
        m.LastName,
        m.Email,
        usr.Role,
        m.LifeGroupID,
        lg.LifeGroupName,
        COALESCE(lg.UnitID, assignedUnit.UnitID) AS UnitID,
        COALESCE(ut.UnitName, assignedUnit.UnitName) AS UnitName,
        COALESCE(ut.SubdistrictID, assignedSubdistrict.SubdistrictID) AS SubdistrictID,
        COALESCE(sd.SubdistrictName, assignedSubdistrict.SubdistrictName) AS SubdistrictName
      FROM Member m
      INNER JOIN \`User\` usr
        ON usr.MemberID = m.MemberID
      LEFT JOIN LifeGroup lg
        ON lg.LifeGroupID = m.LifeGroupID
      LEFT JOIN Unit ut
        ON ut.UnitID = lg.UnitID
      LEFT JOIN Subdistrict sd
        ON sd.SubdistrictID = ut.SubdistrictID
      ${MEMBER_LEADERSHIP_JOINS}
      LEFT JOIN MembershipActive ma
        ON ma.MemberID = m.MemberID
      WHERE usr.Role IN (${placeholders})
        AND COALESCE(ma.IsActive, TRUE) = TRUE
        AND m.Email IS NOT NULL
        AND TRIM(m.Email) <> ''
      ORDER BY m.LastName, m.FirstName
    `,
    validRoles
  );

  return rows;
};

const attachRecipientSummary = async (emails) => {
  const types = {
    'Life Group': { table: 'LifeGroup', id: 'LifeGroupID', name: 'LifeGroupName' },
    Unit: { table: 'Unit', id: 'UnitID', name: 'UnitName' },
    Subdistrict: { table: 'Subdistrict', id: 'SubdistrictID', name: 'SubdistrictName' },
  };
  const parsePart = (part) => part.match(/^(Life Group|Unit|Subdistrict) (\d+(?:\s*,\s*\d+)*)$/);
  const names = {};

  for (const [label, type] of Object.entries(types)) {
    const ids = [...new Set(emails.flatMap((email) =>
      String(email.RecipientScope ?? '').split(' / ').flatMap((part) => {
        const match = parsePart(part);
        return match?.[1] === label ? normalizeIds(match[2].split(',')) : [];
      })
    ))];
    if (!ids.length) continue;

    const [rows] = await pool.execute(
      `SELECT ${type.id} AS id, ${type.name} AS name FROM ${type.table}
       WHERE ${type.id} IN (${ids.map(() => '?').join(', ')})`,
      ids
    );
    names[label] = new Map(rows.map((row) => [Number(row.id), row.name]));
  }

  return emails.map((email) => ({
    ...email,
    RecipientSummary: String(email.RecipientScope ?? '').split(' / ').map((part) => {
      const match = parsePart(part);
      if (!match) return part;
      const [, label, ids] = match;
      return `${label}: ${ids.split(',').map((id) =>
        names[label]?.get(Number(id)) || `Deleted ${label.toLowerCase()} (${id.trim()})`
      ).join(', ')}`;
    }).join(' / '),
  }));
};

const attachDraftRecipients = async (email) => {
  if (!email) {
    return email;
  }

  const match = String(email.RecipientScope ?? '')
    .match(/^Selected Members \[([^\]]*)\]$/);

  if (!match) {
    return email;
  }

  const memberIds = match[1]
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

  return {
    ...email,
    Recipients: await getMembersByIds(memberIds),
  };
};


/* ── getActiveMemberCount ─────────────────────────────────── */

const getActiveMemberCount = async ({
  search = null,
  subdistrictId = null,
  unitId = null,
  lifeGroupId = null,
} = {}) => {
  const conds = [
    'COALESCE(ma.IsActive, TRUE) = TRUE',
    'm.Email IS NOT NULL',
    "TRIM(m.Email) <> ''",
  ];

  const params = [];

  if (search) {
    conds.push(`
      (
        m.FirstName LIKE ?
        OR m.LastName LIKE ?
        OR m.Email LIKE ?
      )
    `);

    const searchValue = `%${search}%`;

    params.push(
      searchValue,
      searchValue,
      searchValue
    );
  }

  addIdFilter(conds, params, 'COALESCE(ut.SubdistrictID, assignedSubdistrict.SubdistrictID)', subdistrictId);
  addIdFilter(conds, params, 'COALESCE(ut.UnitID, assignedUnit.UnitID)', unitId);
  addIdFilter(conds, params, 'm.LifeGroupID', lifeGroupId);

  const [rows] = await pool.execute(
    `
      SELECT COUNT(*) AS total
      FROM Member m
      LEFT JOIN LifeGroup lg
        ON lg.LifeGroupID = m.LifeGroupID
      LEFT JOIN Unit ut
        ON ut.UnitID = lg.UnitID
      ${MEMBER_LEADERSHIP_JOINS}
      LEFT JOIN MembershipActive ma
        ON ma.MemberID = m.MemberID
      WHERE ${conds.join(' AND ')}
    `,
    params
  );

  return rows[0]?.total ?? 0;
};


/* ── createEmailLog ───────────────────────────────────────── */

const createEmailLog = async ({
  senderUserId = null,
  subject,
  message,
  recipientScope = null,
  status = 'Draft',
} = {}) => {
  const [result] = await pool.execute(
    `
      INSERT INTO EmailLog (
        SenderUserID,
        Subject,
        Message,
        RecipientScope,
        Status
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      senderUserId,
      subject,
      message,
      recipientScope,
      status,
    ]
  );

  return getEmailLogById(result.insertId);
};


/* ── updateEmailLog ───────────────────────────────────────── */

const updateEmailLog = async (
  emailId,
  {
    subject,
    message,
    recipientScope,
  } = {}
) => {
  const fields = [];
  const params = [];

  if (subject !== undefined) {
    fields.push('Subject = ?');
    params.push(subject);
  }

  if (message !== undefined) {
    fields.push('Message = ?');
    params.push(message);
  }

  if (recipientScope !== undefined) {
    fields.push('RecipientScope = ?');
    params.push(recipientScope);
  }

  if (fields.length === 0) {
    return getEmailLogById(emailId);
  }

  params.push(emailId);

  const [result] = await pool.execute(
    `
      UPDATE EmailLog
      SET
        ${fields.join(', ')},
        UpdatedAt = CURRENT_TIMESTAMP
      WHERE EmailID = ?
        AND Status = 'Draft'
    `,
    params
  );

  if (result.affectedRows === 0) {
    const email = await getEmailLogById(emailId);

    if (!email) {
      throw new Error('Email record not found');
    }

    if (email.Status !== 'Draft') {
      throw new Error('Only draft emails can be updated');
    }
  }

  return getEmailLogById(emailId);
};


/* ── markEmailAsSent ──────────────────────────────────────── */

const markEmailAsSent = async (emailId) => {
  const [result] = await pool.execute(
    `
      UPDATE EmailLog
      SET
        Status = 'Sent',
        SentAt = CURRENT_TIMESTAMP,
        UpdatedAt = CURRENT_TIMESTAMP
      WHERE EmailID = ?
        AND Status = 'Draft'
    `,
    [emailId]
  );

  if (result.affectedRows === 0) {
    const email = await getEmailLogById(emailId);

    if (!email) {
      throw new Error('Email record not found');
    }

    if (email.Status !== 'Draft') {
      throw new Error('Only draft emails can be sent');
    }
  }

  return getEmailLogById(emailId);
};


/* ── markEmailAsFailed ────────────────────────────────────── */

const markEmailAsFailed = async (emailId) => {
  const [result] = await pool.execute(
    `
      UPDATE EmailLog
      SET
        Status = 'Failed',
        UpdatedAt = CURRENT_TIMESTAMP
      WHERE EmailID = ?
        AND Status = 'Draft'
    `,
    [emailId]
  );

  if (result.affectedRows === 0) {
    return getEmailLogById(emailId);
  }

  return getEmailLogById(emailId);
};


/* ── discardEmailDraft ────────────────────────────────────── */

const discardEmailDraft = async (emailId) => {
  const [result] = await pool.execute(
    `
      UPDATE EmailLog
      SET
        Status = 'Discarded',
        UpdatedAt = CURRENT_TIMESTAMP
      WHERE EmailID = ?
        AND Status = 'Draft'
    `,
    [emailId]
  );

  if (result.affectedRows === 0) {
    const email = await getEmailLogById(emailId);

    if (!email) {
      throw new Error('Email record not found');
    }

    if (email.Status !== 'Draft') {
      throw new Error('Only draft emails can be discarded');
    }
  }

  return getEmailLogById(emailId);
};


/* ── getEmailLogs ─────────────────────────────────────────── */

const getEmailLogs = async ({
  search = null,
  status = null,
  page = 1,
  limit = 10,
} = {}) => {
  const pageNumber = Number(page);
  const pageLimit = Number(limit);
  const offset = (pageNumber - 1) * pageLimit;

  const conds = ['1 = 1'];
  const params = [];

  if (search) {
    conds.push(`
      (
        el.Subject LIKE ?
        OR el.Message LIKE ?
        OR el.RecipientScope LIKE ?
      )
    `);

    const searchValue = `%${search}%`;

    params.push(
      searchValue,
      searchValue,
      searchValue
    );
  }

  if (status) {
    conds.push('el.Status = ?');
    params.push(status);
  }

  const where = `WHERE ${conds.join(' AND ')}`;

  const [rows] = await pool.execute(
    `
      SELECT
        el.EmailID,
        el.SenderUserID,
        el.Subject,
        el.Message,
        el.RecipientScope,
        el.Status,
        el.CreatedAt,
        el.UpdatedAt,
        el.SentAt,
        CONCAT(
          m.FirstName,
          ' ',
          m.LastName
        ) AS SenderName
      FROM EmailLog el
      LEFT JOIN \`User\` usr
        ON usr.UserID = el.SenderUserID
      LEFT JOIN Member m
        ON m.MemberID = usr.MemberID
      ${where}
      ORDER BY el.UpdatedAt DESC
      LIMIT ? OFFSET ?
    `,
    [
      ...params,
      pageLimit,
      offset,
    ]
  );

  const [countRows] = await pool.execute(
    `
      SELECT COUNT(*) AS total
      FROM EmailLog el
      ${where}
    `,
    params
  );

  return {
    emails: await attachRecipientSummary(await Promise.all(
      rows.map(attachDraftRecipients)
    )),
    total: countRows[0]?.total ?? 0,
    page: pageNumber,
    limit: pageLimit,
    totalPages: Math.ceil(
      (countRows[0]?.total ?? 0) / pageLimit
    ),
  };
};


/* ── getEmailLogById ──────────────────────────────────────── */

const getEmailLogById = async (emailId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        el.EmailID,
        el.SenderUserID,
        el.Subject,
        el.Message,
        el.RecipientScope,
        el.Status,
        el.CreatedAt,
        el.UpdatedAt,
        el.SentAt,
        CONCAT(
          m.FirstName,
          ' ',
          m.LastName
        ) AS SenderName
      FROM EmailLog el
      LEFT JOIN \`User\` usr
        ON usr.UserID = el.SenderUserID
      LEFT JOIN Member m
        ON m.MemberID = usr.MemberID
      WHERE el.EmailID = ?
    `,
    [emailId]
  );

  if (!rows[0]) return null;
  const email = await attachDraftRecipients(rows[0]);
  return (await attachRecipientSummary([email]))[0];
};


/* ── getDrafts ────────────────────────────────────────────── */

const getDrafts = async ({
  search = null,
  page = 1,
  limit = 10,
} = {}) => {
  return getEmailLogs({
    search,
    status: 'Draft',
    page,
    limit,
  });
};


/* ── getSubdistricts ──────────────────────────────────────── */

const getSubdistricts = async () => {
  const [rows] = await pool.execute(
    `
      SELECT
        SubdistrictID,
        SubdistrictName
      FROM Subdistrict
      ORDER BY SubdistrictName
    `
  );

  return rows;
};


/* ── getUnits ─────────────────────────────────────────────── */

const getUnits = async () => {
  const [rows] = await pool.execute(
    `
      SELECT
        UnitID,
        UnitName,
        SubdistrictID
      FROM Unit
      ORDER BY UnitName
    `
  );

  return rows;
};


/* ── getLifeGroups ────────────────────────────────────────── */

const getLifeGroups = async () => {
  const [rows] = await pool.execute(
    `
      SELECT
        lg.LifeGroupID,
        lg.LifeGroupName,
        lg.UnitID,
        ut.SubdistrictID
      FROM LifeGroup lg
      LEFT JOIN Unit ut
        ON ut.UnitID = lg.UnitID
      ORDER BY lg.LifeGroupName
    `
  );

  return rows;
};


module.exports = {
  getActiveMembers,
  getMembersByGroup,
  getMembersByUnit,
  getMembersBySubdistrict,
  getMembersByIds,
  getMembersByRoles,
  getActiveMemberCount,

  createEmailLog,
  updateEmailLog,
  markEmailAsSent,
  markEmailAsFailed,
  discardEmailDraft,

  getEmailLogs,
  getEmailLogById,
  getDrafts,

  getSubdistricts,
  getUnits,
  getLifeGroups,
};
