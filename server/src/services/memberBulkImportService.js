const {
  getDefaultPasswordHash,
  getDefaultPasswordInfo,
  setDefaultPasswordHash,
  getExistingEmails,
  getLifeGroupsByName,
  importMembers,
} = require('../repositories/memberBulkImportRepo');
const { hashPassword } = require('../utils/passwordHash');

const MEMBERSHIP_TYPES = new Set(['Member', 'Visitor', 'Consistent Visitor']);
const BELIEVER_STATUSES = new Set(['Pre-believer', 'Believer', 'New Believer']);
const GENDERS = new Set(['Male', 'Female']);
const MARITAL_STATUSES = new Set(['Single', 'Married', 'Widowed', 'Divorced']);
const IMPORTABLE_ROLES = new Set([
  'subdistrict_leader',
  'unit_leader',
  'assistantunit_leader',
  'lg_leader',
  'assistantlg_leader',
  'core_team',
  'member',
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = value => value == null || String(value).trim() === '' ? null : String(value).trim();
const normalizeDate = (value) => {
  if (!value) return null;
  let year, month, day;
  let match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) [, day, month, year] = match;
  else {
    match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return undefined;
    [, year, month, day] = match;
  }
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) {
    return undefined;
  }
  return `${year}-${month}-${day}`;
};

const validateMembers = async (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { members: [], errors: [{ row: 0, message: 'The import contains no members' }] };
  }
  if (rows.length > 500) {
    return { members: [], errors: [{ row: 0, message: 'A maximum of 500 members can be imported at once' }] };
  }

  const normalized = rows.map((row, index) => ({
    row: index + 2,
    firstName: clean(row.firstName),
    lastName: clean(row.lastName),
    email: clean(row.email)?.toLowerCase() ?? null,
    gender: clean(row.gender),
    birthDate: clean(row.birthDate),
    maritalStatus: clean(row.maritalStatus),
    membershipType: clean(row.membershipType) || 'Member',
    believerStatus: clean(row.believerStatus),
    joinDate: clean(row.joinDate),
    memberSince: clean(row.memberSince),
    mobileNumber: clean(row.mobileNumber),
    landlineNumber: clean(row.landlineNumber),
    lifeGroupName: clean(row.lifeGroupName),
    lifeGroupId: null,
    unitId: null,
    subdistrictId: null,
    role: clean(row.role)?.toLowerCase() || 'member',
  }));

  const emails = normalized.map(row => row.email).filter(Boolean);
  const existingEmails = await getExistingEmails([...new Set(emails)]);
  const lifeGroupNames = [...new Set(normalized.map(row => row.lifeGroupName).filter(Boolean))];
  const lifeGroupsByName = await getLifeGroupsByName(lifeGroupNames);
  const seenEmails = new Set();
  const errors = [];

  for (const row of normalized) {
    if (!row.firstName) errors.push({ row: row.row, message: 'First name is required' });
    if (!row.lastName) errors.push({ row: row.row, message: 'Last name is required' });
    if (!row.email || !EMAIL_PATTERN.test(row.email)) errors.push({ row: row.row, message: 'A valid email is required' });
    if (row.email && seenEmails.has(row.email)) errors.push({ row: row.row, message: 'Email is duplicated in this file' });
    if (row.email && existingEmails.has(row.email)) errors.push({ row: row.row, message: 'Email already belongs to a member' });
    if (row.gender && !GENDERS.has(row.gender)) errors.push({ row: row.row, message: 'Gender must be Male or Female' });
    if (row.maritalStatus && !MARITAL_STATUSES.has(row.maritalStatus)) errors.push({ row: row.row, message: 'Invalid marital status' });
    if (!MEMBERSHIP_TYPES.has(row.membershipType)) errors.push({ row: row.row, message: 'Invalid membership type' });
    if (!IMPORTABLE_ROLES.has(row.role)) {
      errors.push({ row: row.row, message: 'Role is invalid or cannot be assigned through bulk import' });
    }
    if (['Visitor', 'Consistent Visitor'].includes(row.membershipType)) {
      if (!row.believerStatus) errors.push({ row: row.row, message: 'Believer status is required for visitors' });
      else if (!BELIEVER_STATUSES.has(row.believerStatus)) errors.push({ row: row.row, message: 'Invalid believer status' });
    } else if (row.believerStatus && !BELIEVER_STATUSES.has(row.believerStatus)) {
      errors.push({ row: row.row, message: 'Invalid believer status' });
    }
    const birthDate = normalizeDate(row.birthDate);
    const joinDate = normalizeDate(row.joinDate);
    const memberSince = normalizeDate(row.memberSince);
    if (birthDate === undefined) errors.push({ row: row.row, message: 'Birth date must be DD-MM-YYYY' });
    else row.birthDate = birthDate;
    if (joinDate === undefined) errors.push({ row: row.row, message: 'Join date must be DD-MM-YYYY' });
    else row.joinDate = joinDate;
    if (memberSince === undefined) errors.push({ row: row.row, message: 'Member since must be DD-MM-YYYY' });
    else row.memberSince = memberSince;
    if (!row.lifeGroupName) {
      errors.push({ row: row.row, message: 'Life group name is required' });
    } else {
      const matches = lifeGroupsByName.get(row.lifeGroupName.toLowerCase()) || [];
      if (matches.length === 0) {
        errors.push({
          row: row.row,
          message: `Life group "${row.lifeGroupName}" was not found, is inactive, or is outside your permitted scope`,
        });
      }
      else if (matches.length > 1) errors.push({ row: row.row, message: `Life group name "${row.lifeGroupName}" is ambiguous` });
      else {
        row.lifeGroupId = matches[0].lifeGroupId;
        row.unitId = matches[0].unitId;
        row.subdistrictId = matches[0].subdistrictId;
      }
    }
    if (row.email) seenEmails.add(row.email);
    if (row.membershipType === 'Member') row.believerStatus = null;
    delete row.lifeGroupName;
    delete row.row;
  }
  return { members: normalized, errors };
};

const bulkImport = async (rows) => {
  const { members, errors } = await validateMembers(rows);
  if (errors.length) {
    const err = new Error('Import validation failed');
    err.statusCode = 400;
    err.details = errors;
    throw err;
  }
  return importMembers(members);
};

const getPasswordStatus = async () => getDefaultPasswordInfo();

const changeDefaultPassword = async (password, userId) => {
  if (typeof password !== 'string' || password.length < 8) {
    const err = new Error('Default password must be at least 8 characters');
    err.statusCode = 400;
    throw err;
  }
  await setDefaultPasswordHash(await hashPassword(password), userId);
  return getDefaultPasswordInfo();
};

module.exports = { bulkImport, getPasswordStatus, changeDefaultPassword };
