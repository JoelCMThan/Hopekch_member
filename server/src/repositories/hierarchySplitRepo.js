const organizationRepo = require('./organizationRepo');
const { pool } = require('../config/db');
const { buildUnitScopeClause, buildSubdistrictScopeClause } = require('../utils/permissions');

// SQL identifiers come only from this internal configuration.
const configurations = {
  unit: { table: 'Unit', id: 'UnitID', name: 'UnitName', alias: 'u', child: 'LifeGroup', childId: 'LifeGroupID', childName: 'LifeGroupName', scope: buildUnitScopeClause },
  subdistrict: { table: 'Subdistrict', id: 'SubdistrictID', name: 'SubdistrictName', alias: 'sd', child: 'Unit', childId: 'UnitID', childName: 'UnitName', scope: buildSubdistrictScopeClause },
};

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};

const getSource = async (db, config, id, user, lock = false) => {
  const scope = config.scope(user);
  const [rows] = await db.execute(
    `SELECT ${config.alias}.* FROM ${config.table} ${config.alias}
     WHERE ${config.alias}.${config.id} = ? ${scope.clause}${lock ? ' FOR UPDATE' : ''}`,
    [id, ...scope.params]
  );
  if (!rows.length) fail('Source not found or outside your scope', 404);
  return rows[0];
};

const getSplitOptions = async (kind, id, user) => {
  const config = configurations[kind];
  await getSource(pool, config, id, user);
  const [source] = await organizationRepo.getStates(kind, [id]);
  const [children] = await pool.execute(
    `SELECT ${config.childId} AS id, ${config.childName} AS name
     FROM ${config.child} WHERE ${config.id} = ? ORDER BY ${config.childName}`, [id]
  );
  const [leaders] = await pool.execute(
    `SELECT m.MemberID AS id, CONCAT_WS(' ', m.FirstName, m.LastName) AS name
     FROM Member m JOIN LifeGroup lg ON lg.LifeGroupID = m.LifeGroupID
     ${kind === 'subdistrict' ? 'JOIN Unit u ON u.UnitID = lg.UnitID' : ''}
     WHERE ${kind === 'unit' ? 'lg.UnitID' : 'u.SubdistrictID'} = ?
     ORDER BY m.FirstName, m.LastName`, [id]
  );
  const childKind = kind === 'unit' ? 'group' : 'unit';
  const states = await organizationRepo.getStates(childKind, children.map(child => child.id));
  const byId = new Map(states.map(state => [Number(state[config.childId]), state]));
  return { source, children: children.map(child => ({ ...child, ...byId.get(Number(child.id)) })), leaders };
};

const splitHierarchy = async (kind, id, user, data) => {
  const config = configurations[kind];
  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  const ids = data?.childIds;
  const leaderId = data?.leaderMemberId ?? null;
  if (!name || name.length > 255) fail('Enter a name of up to 255 characters');
  if (!Array.isArray(ids) || !ids.length || ids.some(value => !Number.isSafeInteger(value) || value <= 0) || new Set(ids).size !== ids.length) {
    fail('Select at least one valid group or unit, without duplicates');
  }
  if (leaderId !== null && (!Number.isSafeInteger(leaderId) || leaderId <= 0)) fail('Invalid leader');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const source = await getSource(conn, config, id, user, true);
    await organizationRepo.assertUsable(kind, id, conn);
    const placeholders = ids.map(() => '?').join(',');
    const [children] = await conn.execute(
      `SELECT ${config.childId} FROM ${config.child}
       WHERE ${config.id} = ? AND ${config.childId} IN (${placeholders}) FOR UPDATE`, [id, ...ids]
    );
    if (children.length !== ids.length) fail('Some selections no longer belong to this source. Reopen the split dialog and try again.');
    const states = await organizationRepo.getStates(kind === 'unit' ? 'group' : 'unit', ids, conn, null, true);
    if (states.length !== ids.length || states.some(child => Number(child.IsUsable) !== 1)) {
      fail('Selected children are inactive or unavailable. Reopen the split dialog and select usable items only.');
    }
    if (leaderId !== null) {
      const [leaders] = await conn.execute(
        `SELECT m.MemberID FROM Member m JOIN LifeGroup lg ON lg.LifeGroupID = m.LifeGroupID
         ${kind === 'subdistrict' ? 'JOIN Unit u ON u.UnitID = lg.UnitID' : ''}
         WHERE m.MemberID = ? AND ${kind === 'unit' ? 'lg.UnitID' : 'u.SubdistrictID'} = ? FOR UPDATE`, [leaderId, id]
      );
      if (!leaders.length) fail('Choose a leader from the original unit or subdistrict');
    }
    const [created] = await conn.execute(
      `INSERT INTO ${config.table} (${config.name}${kind === 'unit' ? ', SubdistrictID' : ''}) VALUES (${kind === 'unit' ? '?, ?' : '?'})`,
      kind === 'unit' ? [name, source.SubdistrictID] : [name]
    );
    const [moved] = await conn.execute(
      `UPDATE ${config.child} SET ${config.id} = ? WHERE ${config.id} = ? AND ${config.childId} IN (${placeholders})`,
      [created.insertId, id, ...ids]
    );
    if (moved.affectedRows !== ids.length) fail('The selected items changed. Please try again.');
    if (leaderId !== null) {
      await conn.execute(
        `INSERT INTO Leadership (MemberID, ScopeTypeID, ScopeID, LeadershipType, IsActiveLeader, AssignedDate)
         VALUES (?, (SELECT ScopeTypeID FROM ScopeType WHERE ScopeName = ? LIMIT 1), ?, 'Leader', TRUE, CURDATE())`,
        [leaderId, config.table, created.insertId]
      );
    }
    await conn.commit();
    return { id: created.insertId, name, movedCount: ids.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = { getSplitOptions, splitHierarchy };
