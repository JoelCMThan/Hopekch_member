const { TABLE_DESCRIPTIONS, COLUMN_DESCRIPTIONS, BUSINESS_RULES } = require('../structured/chunker');

const stableTableId = table => `table:${table}`;
const stableColumnId = (table, column) => `column:${table}.${column}`;
const keyIgnoringCase = (object, key) =>
  Object.keys(object).find(candidate => candidate.toLowerCase() === String(key).toLowerCase());

const buildLpgModel = ({ columns, relationships }) => {
  const tables = new Map();
  const columnNodes = [];

  for (const column of columns) {
    const table = column.TABLE_NAME;
    const metadataTable = keyIgnoringCase(TABLE_DESCRIPTIONS, table);
    if (!tables.has(table)) {
      tables.set(table, {
        id: stableTableId(table), name: table,
        description: TABLE_DESCRIPTIONS[metadataTable] || `MySQL table ${table}.`
      });
    }
    const columnMetadata = COLUMN_DESCRIPTIONS[keyIgnoringCase(COLUMN_DESCRIPTIONS, table)] || {};
    const metadataColumn = keyIgnoringCase(columnMetadata, column.COLUMN_NAME);
    const description = columnMetadata[metadataColumn] ||
      `Column ${column.COLUMN_NAME} in table ${table}.`;
    columnNodes.push({
      id: stableColumnId(table, column.COLUMN_NAME), tableId: stableTableId(table),
      table, name: column.COLUMN_NAME, dataType: column.COLUMN_TYPE,
      nullable: column.IS_NULLABLE === 'YES', primaryKey: column.COLUMN_KEY === 'PRI',
      unique: column.COLUMN_KEY === 'UNI', description
    });
  }

  const foreignKeys = relationships.map(rel => ({
    id: `fk:${rel.TABLE_NAME}.${rel.COLUMN_NAME}->${rel.REFERENCED_TABLE_NAME}.${rel.REFERENCED_COLUMN_NAME}`,
    fromId: stableColumnId(rel.TABLE_NAME, rel.COLUMN_NAME),
    toId: stableColumnId(rel.REFERENCED_TABLE_NAME, rel.REFERENCED_COLUMN_NAME),
    fromTable: rel.TABLE_NAME, fromColumn: rel.COLUMN_NAME,
    toTable: rel.REFERENCED_TABLE_NAME, toColumn: rel.REFERENCED_COLUMN_NAME,
    description: `${rel.TABLE_NAME}.${rel.COLUMN_NAME} references ${rel.REFERENCED_TABLE_NAME}.${rel.REFERENCED_COLUMN_NAME}.`
  }));

  const tableNamesByLowerCase = new Map(
    [...tables.keys()].map(table => [table.toLowerCase(), table])
  );
  const rules = BUSINESS_RULES.flatMap(rule => {
    const actualTable = tableNamesByLowerCase.get(rule.sourceTable.toLowerCase());
    if (!actualTable) return [];
    return [{
      id: `concept:${rule.id}`, name: rule.id, sourceTable: actualTable,
      tableId: stableTableId(actualTable), description: rule.text
    }];
  });
  return { tables: [...tables.values()], columns: columnNodes, foreignKeys, rules };
};

module.exports = { buildLpgModel, stableTableId, stableColumnId };
