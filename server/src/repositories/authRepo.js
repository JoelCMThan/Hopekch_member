const { pool } = require('../config/db');

/* ── findUserByEmail — used by login ──────────────────────── */
const findUserByEmail = async (email) => {
  const [rows] = await pool.execute(
    `SELECT u.UserID, u.MemberID, u.PasswordHash, u.Role, u.CreatedAt,
            CONCAT(m.FirstName, ' ', m.LastName) AS Name,
            m.Email
     FROM \`User\` u
     LEFT JOIN Member m ON u.MemberID = m.MemberID
     WHERE m.Email = ?`,
    [email]
  );

  return rows[0] || null;
};

/* ── findUserById — used by /auth/me (includes isBaptized) ── */
const findUserById = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT u.UserID, u.MemberID, u.Role, u.CreatedAt,
            m.FirstName, m.LastName,
            CONCAT(m.FirstName, ' ', m.LastName) AS Name,
            m.Email, m.Gender, m.BirthDate, m.MaritalStatus,
            COALESCE(ms.MembershipType, 'Member') AS MembershipType,
            ms.BelieverStatus,
            m.JoinDate, m.MemberSince, m.LifeGroupID,

            lg.LifeGroupName,
            ut.UnitID, ut.UnitName,

            ph.MobileNumber,
            ph.LandlineNumber,

            a.StreetAddress,
            a.City,
            a.State,
            a.PostalCode,
            a.Country,

            CASE
              WHEN b.MemberID IS NOT NULL THEN TRUE
              ELSE FALSE
            END AS isBaptized,

            b.BaptismDate,
            b.Venue   AS BaptismVenue,
            b.Remarks AS BaptismRemarks

     FROM \`User\` u
     LEFT JOIN Member     m  ON m.MemberID    = u.MemberID
     LEFT JOIN MembershipStatus ms ON ms.MemberID = m.MemberID
     LEFT JOIN LifeGroup  lg ON lg.LifeGroupID = m.LifeGroupID
     LEFT JOIN Unit       ut ON ut.UnitID      = lg.UnitID
     LEFT JOIN MemberPhone ph ON ph.MemberID   = m.MemberID
     LEFT JOIN Address    a  ON a.MemberID     = m.MemberID
     LEFT JOIN Baptism    b  ON b.MemberID     = m.MemberID
     WHERE u.UserID = ?`,
    [userId]
  );

  return rows[0] || null;
};

/* ── findMemberByEmail — check existing member during register ── */
const findMemberByEmail = async (email) => {
  const [rows] = await pool.execute(
    `SELECT MemberID, FirstName, LastName, Email
     FROM Member
     WHERE Email = ?`,
    [email]
  );

  return rows[0] || null;
};

/* ── userExistsForEmail — check if User row exists for email ── */
const userExistsForEmail = async (email) => {
  const [rows] = await pool.execute(
    `SELECT u.UserID
     FROM \`User\` u
     INNER JOIN Member m ON u.MemberID = m.MemberID
     WHERE m.Email = ?`,
    [email]
  );

  return rows.length > 0;
};

/* ── createMembershipStatus — used during registration ─────── */
const createMembershipStatus = async (
  memberId,
  membershipType = 'Member',
  believerStatus = null,
  conn
) => {
  const normalizedBelieverStatus = membershipType === 'Member' ? null : believerStatus;

  await conn.execute(
    `INSERT INTO MembershipStatus (MemberID, MembershipType, BelieverStatus)
     VALUES (?, ?, ?)`,
    [memberId, membershipType, normalizedBelieverStatus]
  );
};

/* ── createMember ─────────────────────────────────────────── */
const createMember = async (data, conn) => {
  const {
    firstName,
    lastName,
    email,
    gender = null,
    birthDate = null,
    maritalStatus = null,
    membershipType = 'Member',
    believerStatus = null,
    joinDate = null,
    memberSince = null,
  } = data;

  const [result] = await conn.execute(
    `INSERT INTO Member
      (
        FirstName,
        LastName,
        Email,
        Gender,
        BirthDate,
        MaritalStatus,
        JoinDate,
        MemberSince
      )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      firstName,
      lastName,
      email,
      gender,
      birthDate || null,
      maritalStatus,
      joinDate || null,
      memberSince || null,
    ]
  );

  const memberId = result.insertId;
  await createMembershipStatus(memberId, membershipType, believerStatus, conn);
  await conn.execute(
    `INSERT INTO MembershipActive (MemberID, IsActive) VALUES (?, TRUE)`,
    [memberId]
  );
  await conn.execute(
    `INSERT INTO MemberEngagement (MemberID) VALUES (?)`,
    [memberId]
  );
  return memberId;
};

/* ── createMemberPhone ────────────────────────────────────── */
const createMemberPhone = async (
  memberId,
  mobileNumber,
  landlineNumber,
  conn
) => {
  if (!mobileNumber && !landlineNumber) return;

  await conn.execute(
    `INSERT INTO MemberPhone
      (MemberID, MobileNumber, LandlineNumber)
     VALUES (?, ?, ?)`,
    [
      memberId,
      mobileNumber || null,
      landlineNumber || null,
    ]
  );
};

/* ── createAddress ────────────────────────────────────────── */
const createAddress = async (memberId, address, conn) => {
  const {
    streetAddress,
    city,
    state,
    postalCode,
    country,
  } = address;

  if (
    !streetAddress &&
    !city &&
    !state &&
    !postalCode &&
    !country
  ) {
    return;
  }

  await conn.execute(
    `INSERT INTO Address
      (
        MemberID,
        StreetAddress,
        City,
        State,
        PostalCode,
        Country
      )
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      memberId,
      streetAddress || null,
      city || null,
      state || null,
      postalCode || null,
      country || null,
    ]
  );
};

/* ── upsertAddress — used by updateMember ─────────────────── */
const upsertAddress = async (memberId, address) => {
  const {
    streetAddress,
    city,
    state,
    postalCode,
    country,
  } = address;

  const [existing] = await pool.execute(
    `SELECT AddressID
     FROM Address
     WHERE MemberID = ?`,
    [memberId]
  );

  if (existing.length > 0) {
    await pool.execute(
      `UPDATE Address
       SET
         StreetAddress = ?,
         City          = ?,
         State         = ?,
         PostalCode    = ?,
         Country       = ?
       WHERE MemberID = ?`,
      [
        streetAddress || null,
        city || null,
        state || null,
        postalCode || null,
        country || null,
        memberId,
      ]
    );
  } else if (
    streetAddress ||
    city ||
    state ||
    postalCode ||
    country
  ) {
    await pool.execute(
      `INSERT INTO Address
        (
          MemberID,
          StreetAddress,
          City,
          State,
          PostalCode,
          Country
        )
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        memberId,
        streetAddress || null,
        city || null,
        state || null,
        postalCode || null,
        country || null,
      ]
    );
  }
};

/* ── createBaptism ────────────────────────────────────────── */
const createBaptism = async (memberId, baptism, conn) => {
  const {
    baptismDate,
    venue,
    remarks,
  } = baptism;

  await conn.execute(
    `INSERT INTO Baptism
      (
        MemberID,
        BaptismDate,
        Venue,
        Remarks
      )
     VALUES (?, ?, ?, ?)`,
    [
      memberId,
      baptismDate || null,
      venue || null,
      remarks || null,
    ]
  );
};

/* ── upsertBaptism — used by updateMember ─────────────────── */
const upsertBaptism = async (
  memberId,
  isBaptized,
  baptism
) => {
  const [existing] = await pool.execute(
    `SELECT MemberID
     FROM Baptism
     WHERE MemberID = ?`,
    [memberId]
  );

  /* not baptized → remove row */
  if (!isBaptized) {
    if (existing.length > 0) {
      await pool.execute(
        `DELETE FROM Baptism
         WHERE MemberID = ?`,
        [memberId]
      );
    }

    return;
  }

  /* baptized */
  const {
    baptismDate,
    venue,
    remarks,
  } = baptism || {};

  if (existing.length > 0) {
    await pool.execute(
      `UPDATE Baptism
       SET
         BaptismDate = ?,
         Venue       = ?,
         Remarks     = ?
       WHERE MemberID = ?`,
      [
        baptismDate || null,
        venue || null,
        remarks || null,
        memberId,
      ]
    );
  } else {
    await pool.execute(
      `INSERT INTO Baptism
        (
          MemberID,
          BaptismDate,
          Venue,
          Remarks
        )
       VALUES (?, ?, ?, ?)`,
      [
        memberId,
        baptismDate || null,
        venue || null,
        remarks || null,
      ]
    );
  }
};

/* ── createUser ───────────────────────────────────────────── */
const createUser = async (
  memberId,
  passwordHash,
  role,
  conn
) => {
  const [result] = await conn.execute(
    `INSERT INTO \`User\`
      (
        MemberID,
        PasswordHash,
        Role
      )
     VALUES (?, ?, ?)`,
    [
      memberId,
      passwordHash,
      role,
    ]
  );

  return result.insertId;
};

module.exports = {
  findUserByEmail,
  findUserById,
  findMemberByEmail,
  userExistsForEmail,
  createMember,
  createMemberPhone,
  createAddress,
  upsertAddress,
  createBaptism,
  upsertBaptism,
  createUser,
};
