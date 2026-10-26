/**
 * server/src/services/authService.js
 *
 * Registration flow (per requirements):
 *  1. Check if a User account already exists for this email
 *  2. Check if a Member record exists with this email.
 *     - If YES  → link the new User account to that existing member.
 *     - If NO   → create a new Member row first, then the User row.
 *  3. Login uses Member.Email + User.PasswordHash.
 */

const jwt       = require('jsonwebtoken');
const jwtConfig = require('../config/jwtConfig');
const { pool }  = require('../config/db');

const {
  findUserByEmail,
  findUserById,
  findMemberByEmail,
  userExistsForEmail,
  createMember,
  createMemberPhone,
  createAddress,
  createBaptism,
  createUser,
} = require('../repositories/authRepo');

const {
  hashPassword,
  comparePassword,
} = require('../utils/passwordHash');

const generateToken = (payload) =>
  jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });

/* ── register ─────────────────────────────────────────────── */
const register = async (body) => {
  const {
    firstName,
    lastName,
    email,
    password,
    role = 'member',

    gender,
    birthDate,
    maritalStatus,
    membershipType = 'Member',
    believerStatus = null,
    joinDate,
    memberSince,

    mobileNumber,
    landlineNumber,

    /* Address */
    streetAddress,
    city,
    state,
    postalCode,
    country,

    /* Baptism */
    isBaptized = false,
    baptismDate,
    baptismVenue,
    baptismRemarks,
  } = body;

  /* 1 — Block if auth account already exists */
  const accountExists = await userExistsForEmail(email);

  if (accountExists) {
    const err = new Error(
      'An account with this email already exists'
    );

    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await hashPassword(password);
  const connection   = await pool.getConnection();

  try {
    await connection.beginTransaction();

    /* 2 — Reuse existing Member row if present */
    let existingMember = await findMemberByEmail(email);

    let memberId;
    let memberName;

    if (existingMember) {
      memberId = existingMember.MemberID;

      memberName =
        `${existingMember.FirstName} ${existingMember.LastName}`.trim();
    } else {
      /* Require names if creating new member */
      if (!firstName || !lastName) {
        const err = new Error(
          'First name and last name are required'
        );

        err.statusCode = 400;
        throw err;
      }

      memberId = await createMember(
        {
          firstName,
          lastName,
          email,
          gender,
          birthDate,
          maritalStatus,
          membershipType,
          believerStatus,
          joinDate,
          memberSince,
        },
        connection
      );

      memberName = `${firstName} ${lastName}`.trim();

      /* Phone */
      await createMemberPhone(
        memberId,
        mobileNumber,
        landlineNumber,
        connection
      );

      /* Address */
      if (
        streetAddress ||
        city ||
        state ||
        postalCode ||
        country
      ) {
        await createAddress(
          memberId,
          {
            streetAddress,
            city,
            state,
            postalCode,
            country,
          },
          connection
        );
      }

      /* Baptism */
      if (isBaptized) {
        await createBaptism(
          memberId,
          {
            baptismDate,
            venue: baptismVenue,
            remarks: baptismRemarks,
          },
          connection
        );
      }
    }

    /* 3 — Create auth user */
    const userId = await createUser(
      memberId,
      passwordHash,
      role,
      connection
    );

    await connection.commit();

    const token = generateToken({
      userId,
      memberId,
      role,
    });

    return {
      token,
      user: {
        userId,
        memberId,
        name: memberName,
        email,
        role,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/* ── login ────────────────────────────────────────────────── */
const login = async ({ email, password }) => {
  const user = await findUserByEmail(email);

  if (!user) {
    const err = new Error(
      'Invalid email or password'
    );

    err.statusCode = 401;
    throw err;
  }

  const isMatch = await comparePassword(
    password,
    user.PasswordHash
  );

  if (!isMatch) {
    const err = new Error(
      'Invalid email or password'
    );

    err.statusCode = 401;
    throw err;
  }

  const token = generateToken({
    userId:   user.UserID,
    memberId: user.MemberID,
    role:     user.Role,
  });

  return {
    token,
    user: {
      userId:   user.UserID,
      memberId: user.MemberID,
      name:     user.Name,
      email:    user.Email,
      role:     user.Role,
    },
  };
};

/* ── getMe ────────────────────────────────────────────────── */
const getMe = async (userId) => {
  const user = await findUserById(userId);

  if (!user) {
    const err = new Error('User not found');

    err.statusCode = 404;
    throw err;
  }

  return user;
};

module.exports = {
  register,
  login,
  getMe,
};
