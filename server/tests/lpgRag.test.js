const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLpgModel } = require('../src/services/rag/lpg/lpgBuilder');
const { buildTraversalContext } = require('../src/services/rag/common/traversalContextBuilder');

const schema = {
  columns: [
    { TABLE_NAME: 'Member', COLUMN_NAME: 'MemberID', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO', COLUMN_KEY: 'PRI' },
    { TABLE_NAME: 'Member', COLUMN_NAME: 'LifeGroupID', COLUMN_TYPE: 'int', IS_NULLABLE: 'YES', COLUMN_KEY: 'MUL' },
    { TABLE_NAME: 'LifeGroup', COLUMN_NAME: 'LifeGroupID', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO', COLUMN_KEY: 'PRI' },
  ],
  relationships: [{
    TABLE_NAME: 'Member', COLUMN_NAME: 'LifeGroupID',
    REFERENCED_TABLE_NAME: 'LifeGroup', REFERENCED_COLUMN_NAME: 'LifeGroupID'
  }]
};

test('LPG model creates stable table, column, and foreign-key identities', () => {
  const model = buildLpgModel(schema);
  assert.deepEqual(model.tables.map(item => item.id).sort(), ['table:LifeGroup', 'table:Member']);
  assert.ok(model.columns.some(item => item.id === 'column:Member.LifeGroupID'));
  assert.equal(model.foreignKeys[0].id, 'fk:Member.LifeGroupID->LifeGroup.LifeGroupID');
});

test('LPG model is deterministic and does not create member-record nodes', () => {
  assert.deepEqual(buildLpgModel(schema), buildLpgModel(schema));
  assert.equal(buildLpgModel(schema).tables.some(item => item.id === 'member:1'), false);
});

test('LPG business concepts match MySQL table names case-insensitively', () => {
  const lowercaseSchema = {
    columns: [...schema.columns, {
      TABLE_NAME: 'MembershipActive', COLUMN_NAME: 'MemberID', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO', COLUMN_KEY: 'PRI'
    }].map(column => ({
      ...column,
      TABLE_NAME: column.TABLE_NAME.toLowerCase(),
    })),
    relationships: [],
  };
  const model = buildLpgModel(lowercaseSchema);
  assert.ok(model.rules.length > 0);
  assert.ok(model.rules.some(rule => rule.id === 'concept:member-active-status'));
  assert.ok(model.rules.some(rule => rule.tableId === 'table:membershipactive'));
  assert.equal(model.tables.find(table => table.name === 'member').description.includes('personal information'), true);
});

test('context combines semantic nodes with verified traversal paths', () => {
  const context = buildTraversalContext(
    [{ nodeId: 'table:Member', text: 'Member table.' }],
    [{ nodes: [{ id: 'table:Member', description: 'Member table.' }, { id: 'column:Member.LifeGroupID', description: 'Life group reference.' }], relationships: [{ type: 'HAS_COLUMN' }], hops: 1 }]
  );
  assert.match(context, /Relevant schema entities/);
  assert.match(context, /table:Member -> column:Member\.LifeGroupID/);
});
