const { assertUsable } = require('./organizationRepo');

const normalize = value => value === null || value === undefined || value === '' ? null : Number(value);

// Keep the member's stored group separate from the effective leadership scope
// exposed by the existing member details API.
const prepareAssignment = async (conn, data, memberId = null) => {
  let current = null;
  if (memberId !== null) {
    const [rows] = await conn.execute(`
      SELECT m.LifeGroupID AS storedGroupId, usr.Role AS role,
        CASE WHEN st.ScopeName = 'LifeGroup' THEN l.ScopeID ELSE m.LifeGroupID END AS lifeGroupId,
        CASE WHEN st.ScopeName = 'Unit' THEN l.ScopeID WHEN st.ScopeName = 'LifeGroup' THEN leaderG.UnitID ELSE lg.UnitID END AS unitId,
        CASE WHEN st.ScopeName = 'Subdistrict' THEN l.ScopeID WHEN st.ScopeName = 'Unit' THEN leaderU.SubdistrictID
          WHEN st.ScopeName = 'LifeGroup' THEN leaderGU.SubdistrictID ELSE u.SubdistrictID END AS subdistrictId
      FROM Member m
      LEFT JOIN \`User\` usr ON usr.MemberID = m.MemberID
      LEFT JOIN LifeGroup lg ON lg.LifeGroupID = m.LifeGroupID
      LEFT JOIN Unit u ON u.UnitID = lg.UnitID
      LEFT JOIN Leadership l ON l.MemberID = m.MemberID AND l.IsActiveLeader = TRUE
      LEFT JOIN ScopeType st ON st.ScopeTypeID = l.ScopeTypeID
      LEFT JOIN LifeGroup leaderG ON st.ScopeName = 'LifeGroup' AND leaderG.LifeGroupID = l.ScopeID
      LEFT JOIN Unit leaderGU ON leaderGU.UnitID = leaderG.UnitID
      LEFT JOIN Unit leaderU ON st.ScopeName = 'Unit' AND leaderU.UnitID = l.ScopeID
      WHERE m.MemberID = ? LIMIT 1 FOR UPDATE`, [memberId]);
    current = rows[0];
    if (!current) throw Object.assign(new Error('Member not found'), { status: 404 });
  }
  const roleChanged = data.role != null && data.role !== (current?.role ?? 'member');
  let changed = !current || roleChanged;
  for (const [field, kind] of [['subdistrictId', 'subdistrict'], ['unitId', 'unit'], ['lifeGroupId', 'group']]) {
    if (data[field] === undefined && !roleChanged) continue;
    const value = normalize(data[field] === undefined ? current?.[field] : data[field]);
    if (value !== null && (!Number.isSafeInteger(value) || value <= 0)) throw Object.assign(new Error('Invalid organizational assignment'), { status: 400 });
    const fieldChanged = value !== normalize(current?.[field]);
    if (fieldChanged) changed = true;
    if (value !== null && (!current || fieldChanged || roleChanged)) await assertUsable(kind, value, conn);
  }
  const effectiveGroup = data.lifeGroupId === undefined ? normalize(current?.lifeGroupId) : normalize(data.lifeGroupId);
  return {
    storedGroupId: current && effectiveGroup === normalize(current.lifeGroupId) ? current.storedGroupId : effectiveGroup,
    changed,
    scope: {
      lifeGroupId: effectiveGroup,
      unitId: data.unitId === undefined ? current?.unitId : normalize(data.unitId),
      subdistrictId: data.subdistrictId === undefined ? current?.subdistrictId : normalize(data.subdistrictId),
    },
  };
};

module.exports = { prepareAssignment };
