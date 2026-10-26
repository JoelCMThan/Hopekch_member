
const { Parser } = require('node-sql-parser');
const config = require('../../../config/ragConfig');
const { COLUMN_DESCRIPTIONS } = require('./chunker');

const parser = new Parser();

const knownColumns = new Map(Object.entries(COLUMN_DESCRIPTIONS).map(([table, columns]) => [
  table.toLowerCase(),
  new Set(Object.keys(columns).map(column => column.toLowerCase()))
]));

const validateQualifiedColumns = (ast) => {
  const aliases = new Map((ast.from || []).filter(item => item?.table).map(item => [
    String(item.as || item.table).toLowerCase(),
    String(item.table).toLowerCase()
  ]));

  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'column_ref' && value.table && value.column !== '*') {
      const table = aliases.get(String(value.table).toLowerCase()) || String(value.table).toLowerCase();
      const columns = knownColumns.get(table);
      if (columns && !columns.has(String(value.column).toLowerCase())) {
        throw new Error(`Column ${value.table}.${value.column} does not exist in the approved schema.`);
      }
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };

  visit(ast);
};

const validateSQL = (sql) => {
  if (!sql || typeof sql !== 'string') {
    throw new Error('SQL query is missing.');
  }

  const statement = sql.trim();

  if (statement.length > 10000) {
    throw new Error('SQL query is too long.');
  }

  let ast;

  try {
    ast = parser.astify(statement, {
      database: 'MySQL'
    });
  } catch {
    throw new Error('Invalid SQL syntax.');
  }

  // Reject multiple statements.
  if (Array.isArray(ast)) {
    if (ast.length !== 1) {
      throw new Error(
        'Multiple SQL statements are not allowed.'
      );
    }
    [ast] = ast;
  }

  if (ast.type !== 'select') {
    throw new Error(
      'Only SELECT queries are permitted.'
    );
  }

  if (ast.into && Object.values(ast.into).some(value => value != null)) {
    throw new Error(
      'SELECT INTO is not permitted.'
    );
  }

  const referencedTables = parser.tableList(
    statement,
    { database: 'MySQL' }
  );

  const allowed = new Set(
    config.allowedTables.map(t => t.toLowerCase())
  );

  for (const reference of referencedTables) {
    const parts = reference.split('::');

    const operation = parts[0];
    const database = parts[1];
    const table = parts[2];

    if (operation !== 'select') {
      throw new Error('Invalid SQL operation.');
    }

    if (database && database !== 'null') {
      throw new Error(
        'Cross-database queries are not allowed.'
      );
    }

    if (!allowed.has(table.toLowerCase())) {
      throw new Error(
        `Table ${table} is not permitted.`
      );
    }
  }

  if (ast.set_op || ast._next) {
    throw new Error('UNION and set-operation queries are not permitted.');
  }

  validateQualifiedColumns(ast);

  // Credentials and authentication secrets remain forbidden even if a future
  // database grant or schema-indexing change accidentally exposes them.
  if (/\b(?:PasswordHash|Password|Token|Secret)\b/i.test(statement)) {
    throw new Error('Sensitive authentication columns are not permitted.');
  }

  if (/\/\*|--|#/g.test(statement)) {
    throw new Error('SQL comments are not permitted.');
  }

  const containsSelectedWildcard = (selectAst) =>
    (selectAst.columns || []).some(column =>
      column?.expr?.type === 'star' ||
      (column?.expr?.type === 'column_ref' && column.expr.column === '*')
    );

  if (containsSelectedWildcard(ast)) {
    throw new Error('SELECT * is not permitted.');
  }

  // Reject potentially dangerous or expensive constructs.
  if (
    /\b(?:SLEEP|BENCHMARK|GET_LOCK|LOAD_FILE)\s*\(/i
      .test(statement)
  ) {
    throw new Error('SQL function is not permitted.');
  }

  if (
    /\b(?:FOR\s+UPDATE|LOCK\s+IN\s+SHARE\s+MODE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b/i
      .test(statement)
  ) {
    throw new Error('SQL operation is not permitted.');
  }

  return {
    sql: statement,
    tables: referencedTables.map(reference => reference.split('::')[2]),
  };
};

module.exports = { validateSQL };
