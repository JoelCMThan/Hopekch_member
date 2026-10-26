const fs = require('node:fs');
const path = require('node:path');

const outputPath = path.join(__dirname, 'seeds.sql');
const PASSWORD_HASH = '$2b$10$caCt4xzwWMeMg6IFAxAI6exAiRSl8IS5cD7af8u82UBPv832fX2xa'; // Password123

const firstNames = [
  'Aaron', 'Abigail', 'Adrian', 'Alicia', 'Amelia', 'Andrew', 'Angela', 'Benjamin', 'Brandon', 'Caleb',
  'Carmen', 'Cheryl', 'Daniel', 'Deborah', 'Derrick', 'Elaine', 'Elijah', 'Esther', 'Ethan', 'Eunice',
  'Felicia', 'Gabriel', 'Grace', 'Hannah', 'Isaac', 'Isabelle', 'Jason', 'Joanna', 'Joel', 'Jonathan',
  'Joshua', 'Joyce', 'Karen', 'Kevin', 'Leah', 'Leonard', 'Lydia', 'Marcus', 'Maria', 'Matthew',
  'Melissa', 'Micah', 'Naomi', 'Nathan', 'Nicole', 'Olivia', 'Priscilla', 'Rachel', 'Rebecca', 'Ryan',
  'Samuel', 'Sarah', 'Sharon', 'Stephen', 'Timothy', 'Vanessa', 'Victor', 'Wendy', 'Zachary', 'Zoe',
  'Aiman', 'Aisyah', 'Amir', 'Farah', 'Hakim', 'Nadia', 'Rizal', 'Sofia', 'Darren', 'Jolene',
  'Jovin', 'Mabel', 'Melvin', 'Serena', 'Terence', 'Tracy', 'Alvin', 'Belinda', 'Cynthia', 'Dominic',
];

const lastNames = [
  'Abang', 'Agi', 'Akang', 'Anak Jantan', 'Anak Laja', 'Anak Mawan', 'Awang', 'Bala', 'Bong', 'Chai',
  'Chan', 'Chang', 'Chin', 'Chong', 'Chua', 'Ding', 'Goh', 'Hamzah', 'Ho', 'Ibrahim',
  'Jantai', 'Jelani', 'Juin', 'Kassim', 'Kho', 'Koh', 'Kuek', 'Lai', 'Lee', 'Lim',
  'Ling', 'Liew', 'Loh', 'Lu', 'Mahmud', 'Masing', 'Ng', 'Nyuak', 'Ong', 'Pang',
  'Rahman', 'Rantai', 'Sim', 'Siong', 'Tan', 'Ting', 'Wee', 'Wong', 'Yap', 'Yeo',
];

const locations = [
  { zone: 'Kuching Central', area: 'Padungan', street: 'Jalan Padungan', postcode: '93100', lat: 1.55210, lng: 110.35920 },
  { zone: 'Kuching Central', area: 'Pending', street: 'Jalan Pending', postcode: '93450', lat: 1.54350, lng: 110.38330 },
  { zone: 'Kuching Central', area: 'Sekama', street: 'Jalan Sekama', postcode: '93300', lat: 1.54520, lng: 110.37340 },
  { zone: 'Kuching Central', area: 'Kenyalang Park', street: 'Jalan Kenyalang', postcode: '93300', lat: 1.53590, lng: 110.37200 },
  { zone: 'Kuching North', area: 'Petra Jaya', street: 'Jalan Astana', postcode: '93050', lat: 1.57650, lng: 110.34240 },
  { zone: 'Kuching North', area: 'Semariang', street: 'Jalan Semariang', postcode: '93050', lat: 1.61420, lng: 110.32670 },
  { zone: 'Kuching North', area: 'Santubong', street: 'Jalan Sultan Tengah', postcode: '93050', lat: 1.67620, lng: 110.32680 },
  { zone: 'Kuching North', area: 'Demak Laut', street: 'Jalan Bako', postcode: '93050', lat: 1.58800, lng: 110.40760 },
  { zone: 'Kuching South', area: 'Tabuan Jaya', street: 'Jalan Setia Raja', postcode: '93350', lat: 1.52080, lng: 110.38280 },
  { zone: 'Kuching South', area: 'BDC', street: 'Jalan Stutong', postcode: '93350', lat: 1.50680, lng: 110.36180 },
  { zone: 'Kuching South', area: 'Stampin', street: 'Jalan Stampin', postcode: '93350', lat: 1.51280, lng: 110.34380 },
  { zone: 'Kuching South', area: 'Stutong', street: 'Jalan Setia Raja', postcode: '93350', lat: 1.50490, lng: 110.38530 },
  { zone: 'Batu Kawa', area: 'Batu Kawa', street: 'Jalan Batu Kawa', postcode: '93250', lat: 1.51830, lng: 110.28460 },
  { zone: 'Batu Kawa', area: 'MJC', street: 'Jalan Batu Kawa-Matang', postcode: '93250', lat: 1.53170, lng: 110.29380 },
  { zone: 'Batu Kawa', area: 'Taman Desa Wira', street: 'Jalan Desa Wira', postcode: '93250', lat: 1.49530, lng: 110.29740 },
  { zone: 'Batu Kawa', area: 'Malihah', street: 'Jalan Matang', postcode: '93050', lat: 1.58390, lng: 110.29590 },
  { zone: 'Samarahan Gateway', area: 'Kota Sentosa', street: 'Jalan Penrissen', postcode: '93250', lat: 1.46780, lng: 110.33470 },
  { zone: 'Samarahan Gateway', area: 'Mile 7', street: 'Jalan Kuching-Serian', postcode: '93250', lat: 1.47490, lng: 110.33420 },
  { zone: 'Samarahan Gateway', area: 'Muara Tuang', street: 'Jalan Datuk Mohammad Musa', postcode: '94300', lat: 1.45940, lng: 110.44140 },
  { zone: 'Samarahan Gateway', area: 'Aiman', street: 'Jalan Uni-Central', postcode: '94300', lat: 1.46230, lng: 110.42680 },
];

const rolePlan = [
  ['master_admin', 1], ['admin', 4], ['manager', 10], ['subdistrict_leader', 10],
  ['unit_leader', 30], ['assistantunit_leader', 15], ['lg_leader', 60],
  ['assistantlg_leader', 60], ['core_team', 100], ['member', 710],
];

const esc = value => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const bool = value => value ? 'TRUE' : 'FALSE';
const date = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const jitter = (base, index, scale = 0.004) => (base + (((index * 37) % 101) - 50) / 50 * scale).toFixed(8);

const statements = [];
const add = text => statements.push(text.trim());
const insertBatches = (table, columns, rows, size = 250) => {
  for (let start = 0; start < rows.length; start += size) {
    const batch = rows.slice(start, start + size);
    add(`INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${batch.map(row => `(${row.join(', ')})`).join(',\n')};`);
  }
};

add(`-- Hope Church realistic Kuching seed dataset
-- Generated by database/generate_realistic_seeds.js
-- Exactly 1,000 synthetic members and user accounts. No real personal data.
-- Test password for every seeded account: Password123
-- Run only against a newly created, empty church_db database.

USE church_db;
SET NAMES utf8mb4;
START TRANSACTION;`);

const subdistricts = ['Kuching Central', 'Kuching North', 'Kuching South', 'Batu Kawa', 'Samarahan Gateway'];
insertBatches('Subdistrict', ['SubdistrictID', 'SubdistrictName', 'IsActive'],
  subdistricts.map((name, i) => [i + 1, esc(name), 'TRUE']));

const unitRows = [];
const unitNames = [];
for (let s = 0; s < subdistricts.length; s += 1) {
  for (let u = 0; u < 3; u += 1) {
    const id = s * 3 + u + 1;
    const name = `${subdistricts[s]} Unit ${String.fromCharCode(65 + u)}`;
    unitNames.push(name);
    unitRows.push([id, s + 1, esc(name), 'TRUE']);
  }
}
insertBatches('Unit', ['UnitID', 'SubdistrictID', 'UnitName', 'IsActive'], unitRows);

const groupRows = [];
const groupMeta = [];
for (let unit = 1; unit <= 15; unit += 1) {
  for (let g = 0; g < 4; g += 1) {
    const id = (unit - 1) * 4 + g + 1;
    const loc = locations[(id - 1) % locations.length];
    const name = `${loc.area} Hope ${g + 1}`;
    const meetingAddress = `${18 + ((id * 7) % 160)}, ${loc.street}, ${loc.area}, ${loc.postcode} Kuching, Sarawak`;
    const meta = { id, unitId: unit, subdistrictId: Math.ceil(unit / 3), name, loc, meetingAddress };
    groupMeta.push(meta);
    groupRows.push([id, unit, esc(name), esc(meetingAddress), jitter(loc.lat, id), jitter(loc.lng, id + 11), 'TRUE']);
  }
}
insertBatches('LifeGroup', ['LifeGroupID', 'UnitID', 'LifeGroupName', 'MeetingAddress', 'Latitude', 'Longitude', 'IsActive'], groupRows);
insertBatches('ScopeType', ['ScopeTypeID', 'ScopeName'], [[1, esc('LifeGroup')], [2, esc('Unit')], [3, esc('Subdistrict')]]);

const roles = [];
for (const [role, count] of rolePlan) for (let i = 0; i < count; i += 1) roles.push(role);

const memberRows = [];
const statusRows = [];
const phoneRows = [];
const addressRows = [];
const userRows = [];
const activeRows = [];
const engagementRows = [];
const baptismRows = [];
const memberGroup = new Map();

// Give the analytics charts visibly different group sizes while retaining exactly
// 999 assigned members. The deterministic shuffle keeps roles and join dates mixed.
const groupWeights = Array.from({ length: 60 }, (_, index) => 6 + ((index * 7) % 23));
const totalGroupWeight = groupWeights.reduce((sum, weight) => sum + weight, 0);
const groupSizes = groupWeights.map(weight => Math.floor((weight / totalGroupWeight) * 999));
for (let remaining = 999 - groupSizes.reduce((sum, size) => sum + size, 0), index = 0; remaining > 0; index += 1, remaining -= 1) {
  groupSizes[(index * 17) % groupSizes.length] += 1;
}
const groupAssignments = groupSizes.flatMap((size, index) => Array(size).fill(index + 1));
const shuffledGroupAssignments = Array(999);
for (let index = 0; index < groupAssignments.length; index += 1) {
  shuffledGroupAssignments[(index * 499) % groupAssignments.length] = groupAssignments[index];
}

for (let id = 1; id <= 1000; id += 1) {
  const role = roles[id - 1];
  const first = firstNames[(id * 17 + Math.floor(id / 13)) % firstNames.length];
  const last = lastNames[(id * 11 + Math.floor(id / 7)) % lastNames.length];
  const gender = id % 2 ? 'Male' : 'Female';
  const age = 16 + ((id * 29) % 59);
  const birthYear = 2026 - age;
  const birthDate = date(birthYear, (id % 12) + 1, (id % 27) + 1);
  const maritalStatus = age < 24 ? 'Single' : ['Married', 'Single', 'Married', 'Widowed', 'Divorced'][id % 5];
  const groupId = role === 'master_admin' ? null : shuffledGroupAssignments[id - 2];
  if (groupId) memberGroup.set(id, groupId);
  const joinYear = 2012 + ((id * 7) % 15);
  const joinDate = date(joinYear, ((id * 3) % 12) + 1, ((id * 5) % 27) + 1);
  let membershipType = 'Member';
  if (id > 800 && id <= 930) membershipType = 'Consistent Visitor';
  if (id > 930) membershipType = 'Visitor';
  const memberSince = membershipType === 'Member'
    ? date(Math.min(2026, joinYear + 1 + (id % 4)), ((id * 3) % 12) + 1, ((id * 5) % 27) + 1)
    : null;
  const email = role === 'master_admin' ? 'master.admin@hopechurch.org' :
    `${first}.${last.replaceAll(' ', '.').replaceAll("'", '').toLowerCase()}.${String(id).padStart(4, '0')}@seed.hopechurch.org`.toLowerCase();
  memberRows.push([id, groupId ?? 'NULL', esc(first), esc(last), esc(gender), esc(birthDate), esc(maritalStatus), esc(email), esc(joinDate), esc(memberSince)]);

  const believerStatus = membershipType === 'Member' ? null : ['Pre-believer', 'Believer', 'New Believer'][id % 3];
  statusRows.push([id, esc(membershipType), esc(believerStatus)]);

  phoneRows.push([id, esc(`01${[2, 3, 4, 6, 7, 8, 9][id % 7]}-${String(1000000 + ((id * 7919) % 8999999))}`), id % 4 === 0 ? esc(`082-${String(200000 + id).slice(-6)}`) : 'NULL']);
  const loc = locations[(id * 7) % locations.length];
  const streetAddress = `${1 + ((id * 19) % 220)}, Lorong ${loc.area} ${1 + (id % 12)}, ${loc.street}`;
  addressRows.push([id, id, esc(streetAddress), esc('Kuching'), esc('Sarawak'), esc(loc.postcode), esc('Malaysia'), jitter(loc.lat, id, .009), jitter(loc.lng, id + 23, .009)]);
  userRows.push([id, id, esc(PASSWORD_HASH), esc(role), esc(`2026-${String((id % 10) + 1).padStart(2, '0')}-${String((id % 27) + 1).padStart(2, '0')} 09:00:00`)]);

  const inactive = id > 940 && id % 2 === 0;
  const reasons = ['Transferred University', 'Moved', 'Changed Church', 'Migrant', 'Personal', 'Others'];
  activeRows.push([id, bool(!inactive), inactive ? esc(reasons[id % reasons.length]) : 'NULL', inactive ? esc('Synthetic historical record for reporting and workflow testing.') : 'NULL', inactive ? 2 : 'NULL', inactive ? esc(`2026-${String((id % 9) + 1).padStart(2, '0')}-15 10:00:00`) : 'NULL']);
  const activeLifeGroup = !inactive && membershipType !== 'Visitor' && id % 5 !== 0;
  const activeSunday = !inactive && id % 6 !== 0;
  const serving = !inactive && membershipType === 'Member' && id % 4 === 0;
  engagementRows.push([id, bool(activeLifeGroup || activeSunday || serving), bool(activeLifeGroup), bool(activeSunday), bool(serving)]);

  if (membershipType === 'Member' && id % 4 !== 1) {
    const baptismYear = Math.max(birthYear + 13, Math.min(2025, joinYear + (id % 4)));
    baptismRows.push([id, esc(date(baptismYear, ((id + 4) % 12) + 1, ((id + 9) % 27) + 1)), esc(id % 3 === 0 ? 'Hope Church Kuching' : 'Kuching Community Baptism Service'), esc('Synthetic baptism record.')]);
  }
}

insertBatches('Member', ['MemberID', 'LifeGroupID', 'FirstName', 'LastName', 'Gender', 'BirthDate', 'MaritalStatus', 'Email', 'JoinDate', 'MemberSince'], memberRows);
insertBatches('MembershipStatus', ['MemberID', 'MembershipType', 'BelieverStatus'], statusRows);
insertBatches('MemberPhone', ['MemberID', 'MobileNumber', 'LandlineNumber'], phoneRows);
insertBatches('Address', ['AddressID', 'MemberID', 'StreetAddress', 'City', 'State', 'PostalCode', 'Country', 'Latitude', 'Longitude'], addressRows);
insertBatches('`User`', ['UserID', 'MemberID', 'PasswordHash', 'Role', 'CreatedAt'], userRows);
insertBatches('MembershipActive', ['MemberID', 'IsActive', 'InactiveReason', 'AdditionalNotes', 'DeactivatedByMemberID', 'DeactivatedDate'], activeRows);
insertBatches('MemberEngagement', ['MemberID', 'IsActiveEngage', 'IsActiveLifeGroup', 'IsActiveSundayService', 'IsActiveServing'], engagementRows);
insertBatches('Baptism', ['MemberID', 'BaptismDate', 'Venue', 'Remarks'], baptismRows);

const idsByRole = role => roles.map((value, index) => value === role ? index + 1 : null).filter(Boolean);
const leadershipRows = [];
let leadershipId = 1;
idsByRole('subdistrict_leader').forEach((memberId, index) => {
  leadershipRows.push([leadershipId++, memberId, 3, (index % 5) + 1, esc('Leader'), 'TRUE', esc('2024-01-01')]);
});
idsByRole('unit_leader').forEach((memberId, index) => {
  leadershipRows.push([leadershipId++, memberId, 2, (index % 15) + 1, esc('Leader'), 'TRUE', esc('2024-02-01')]);
});
idsByRole('assistantunit_leader').forEach((memberId, index) => {
  leadershipRows.push([leadershipId++, memberId, 2, index + 1, esc('Assistant Leader'), 'TRUE', esc('2024-03-01')]);
});
idsByRole('lg_leader').forEach((memberId, index) => {
  const scopeId = index + 1;
  leadershipRows.push([leadershipId++, memberId, 1, scopeId, esc('Leader'), 'TRUE', esc('2024-04-01')]);
  memberGroup.set(memberId, scopeId);
});
idsByRole('assistantlg_leader').forEach((memberId, index) => {
  const scopeId = index + 1;
  leadershipRows.push([leadershipId++, memberId, 1, scopeId, esc('Assistant Leader'), 'TRUE', esc('2024-05-01')]);
  memberGroup.set(memberId, scopeId);
});
insertBatches('Leadership', ['LeadershipID', 'MemberID', 'ScopeTypeID', 'ScopeID', 'LeadershipType', 'IsActiveLeader', 'AssignedDate'], leadershipRows);

// Ensure every life-group leader belongs to the group they lead.
for (const [memberId, groupId] of memberGroup.entries()) {
  if (['lg_leader', 'assistantlg_leader'].includes(roles[memberId - 1])) {
    add(`UPDATE Member SET LifeGroupID = ${groupId} WHERE MemberID = ${memberId};`);
  }
}

const attendanceRows = [];
let attendanceId = 1;
let attendanceSeed = 20261026;
const start = new Date(Date.UTC(2024, 0, 7));
const finalSeedSunday = new Date(Date.UTC(2026, 9, 25));
for (let week = 0; ; week += 1) {
  const service = new Date(start.getTime() + week * 7 * 86400000);
  if (service > finalSeedSunday) break;
  const serviceDate = service.toISOString().slice(0, 10);
  attendanceSeed = (attendanceSeed * 1664525 + 1013904223) >>> 0;
  const randomOffset = (attendanceSeed % 151) - 75;
  const gradualTrend = Math.round(week * 0.28);
  const eventBoost = week % 17 === 0 ? 28 : week % 13 === 0 ? 16 : 0;
  let attendanceCount = Math.max(
    205,
    Math.min(445, 285 + gradualTrend + randomOffset + eventBoost)
  );
  // Keep the requested full range represented without turning the series into a smooth curve.
  if (week === 0) attendanceCount = 190;
  if (week === 26) attendanceCount = 458;
  const remarks = week % 13 === 0
    ? 'Communion Sunday service'
    : week % 17 === 0
      ? 'Family Sunday service'
      : 'Sunday worship service';
  attendanceRows.push([
    attendanceId++,
    esc(serviceDate),
    esc('Sunday Service'),
    attendanceCount,
    esc(remarks),
  ]);
}
insertBatches('ServiceAttendance', ['AttendanceID', 'ServiceDate', 'SessionTime', 'AttendanceCount', 'Remarks'], attendanceRows);

const emailRows = [];
const subjects = ['Sunday Service Update', 'Life Group Gathering', 'Volunteer Roster', 'Prayer Meeting', 'Community Outreach', 'Leadership Training'];
for (let id = 1; id <= 120; id += 1) {
  const sender = 2 + (id % 13); // admin and manager accounts
  const status = id % 17 === 0 ? 'Failed' : id % 11 === 0 ? 'Draft' : 'Sent';
  const created = `2026-${String(((id - 1) % 10) + 1).padStart(2, '0')}-${String(((id * 3) % 27) + 1).padStart(2, '0')} 08:30:00`;
  emailRows.push([id, sender, esc(subjects[id % subjects.length]), esc('Synthetic message created for communication history and reporting tests.'), esc(id % 3 === 0 ? 'All Members' : id % 3 === 1 ? 'Leaders' : 'Life Group Members'), esc(status), esc(created), esc(created), status === 'Sent' ? esc(created) : 'NULL']);
}
insertBatches('EmailLog', ['EmailID', 'SenderUserID', 'Subject', 'Message', 'RecipientScope', 'Status', 'CreatedAt', 'UpdatedAt', 'SentAt'], emailRows);

add(`COMMIT;

-- Verification summary
SELECT COUNT(*) AS Members FROM Member;
SELECT COUNT(*) AS UserAccounts FROM \`User\`;
SELECT Role, COUNT(*) AS Total FROM \`User\` GROUP BY Role ORDER BY Role;
SELECT MembershipType, COUNT(*) AS Total FROM MembershipStatus GROUP BY MembershipType ORDER BY MembershipType;
SELECT COUNT(*) AS LifeGroups FROM LifeGroup;
SELECT COUNT(*) AS LeadershipAssignments FROM Leadership;`);

fs.writeFileSync(outputPath, `${statements.join('\n\n')}\n`, 'utf8');
console.log(`Generated ${outputPath}`);
