const { Parser } = require('node-sql-parser');
const {
  canAccessRagModule,
  buildChurchMemberClause,
  getHierarchyLevel,
  getHierarchyScope,
  getScopeLabel,
} = require('../../../utils/permissions');
const { getMemberLeadershipScope } = require('../../../repositories/organizationRepo');

const parser = new Parser();
const RESTRICTED_TABLES = new Set(['emaillog']);

const forbidden = (message) => {
  const error = new Error(message);
  error.statusCode = 403;
  error.publicMessage = message;
  return error;
};

/** First authorization gate: authenticate the actor and resolve the exact
 * database scope that subsequent retrieval and SQL authorization must use. */
const authorizeRagQuestion = async (user) => {
  const role = user?.role;
  const memberId = Number(user?.memberId ?? user?.MemberID);

  if (!canAccessRagModule(role)) {
    throw forbidden('You do not have permission to use the AI assistant.');
  }

  const level = getHierarchyLevel(role);
  const scope = getHierarchyScope(role);

  if (scope === 'all') {
    return {
      role,
      level,
      scope,
      scopeLabel: getScopeLabel(role),
      memberId: Number.isInteger(memberId) ? memberId : null,
    };
  }

  if (!Number.isInteger(memberId) || memberId <= 0) {
    throw forbidden('Your account is not linked to a valid member profile.');
  }

  const organization = await getMemberLeadershipScope(memberId, scope);
  const requiredId = {
    subdistrict: organization?.subdistrictId,
    unit: organization?.unitId,
    lifeGroup: organization?.lifeGroupId,
  }[scope];

  if (!organization || requiredId == null) {
    throw forbidden(`Your account has no active ${scope} leadership assignment for RAG access.`);
  }

  return {
    role,
    level,
    scope,
    scopeLabel: getScopeLabel(role),
    memberId,
    lifeGroupId: organization.lifeGroupId == null ? null : Number(organization.lifeGroupId),
    unitId: organization.unitId == null ? null : Number(organization.unitId),
    subdistrictId: organization.subdistrictId == null ? null : Number(organization.subdistrictId),
  };
};

const quoteIdentifier = (identifier) => `\`${String(identifier).replace(/`/g, '``')}\``;

const directTables = (ast) => (ast.from || [])
  .filter(item => item && item.table)
  .map(item => ({
    table: String(item.table).toLowerCase(),
    alias: item.as || item.table,
  }));

const scopePredicate = (tables, context) => {
  const byName = (name) => tables.find(item => item.table === name.toLowerCase());
  const member = byName('Member');
  const lifeGroup = byName('LifeGroup');
  const unit = byName('Unit');
  const subdistrict = byName('Subdistrict');
  const column = (entry, name) => `${quoteIdentifier(entry.alias)}.${quoteIdentifier(name)}`;

  if (context.scope === 'lifeGroup') {
    if (member) return `${column(member, 'LifeGroupID')} = ${context.lifeGroupId}`;
    if (lifeGroup) return `${column(lifeGroup, 'LifeGroupID')} = ${context.lifeGroupId}`;
  }

  if (context.scope === 'unit') {
    if (member) return `${column(member, 'LifeGroupID')} IN (SELECT LifeGroupID FROM LifeGroup WHERE UnitID = ${context.unitId})`;
    if (lifeGroup) return `${column(lifeGroup, 'UnitID')} = ${context.unitId}`;
    if (unit) return `${column(unit, 'UnitID')} = ${context.unitId}`;
  }

  if (context.scope === 'subdistrict') {
    if (member) return `${column(member, 'LifeGroupID')} IN (SELECT lg_scope.LifeGroupID FROM LifeGroup AS lg_scope INNER JOIN Unit AS u_scope ON u_scope.UnitID = lg_scope.UnitID WHERE u_scope.SubdistrictID = ${context.subdistrictId})`;
    if (lifeGroup) return `${column(lifeGroup, 'UnitID')} IN (SELECT UnitID FROM Unit WHERE SubdistrictID = ${context.subdistrictId})`;
    if (unit) return `${column(unit, 'SubdistrictID')} = ${context.subdistrictId}`;
    if (subdistrict) return `${column(subdistrict, 'SubdistrictID')} = ${context.subdistrictId}`;
  }

  return null;
};

/** Second authorization gate: inspect the generated SQL and force a row-level
 * predicate derived from the authenticated account, never from the prompt. */
const authorizeGeneratedSQL = (sql, context, referencedTables = []) => {
  if (!context || !canAccessRagModule(context.role)) {
    throw forbidden('RAG authorization context is missing or invalid.');
  }

  for (const table of referencedTables) {
    if (RESTRICTED_TABLES.has(String(table).toLowerCase())) {
      throw forbidden(`Your current role does not have permission to access ${table} data.`);
    }
  }

  let ast;
  try {
    ast = parser.astify(sql, { database: 'MySQL' });
  } catch {
    throw forbidden('The generated query could not be authorized.');
  }

  if (Array.isArray(ast)) {
    if (ast.length !== 1) {
      throw forbidden('The generated query could not be authorized.');
    }
    [ast] = ast;
  }

  if (ast.type !== 'select') {
    throw forbidden('The generated query could not be authorized.');
  }

  const tables = directTables(ast);
  const member = tables.find(item => item.table === 'member');
  const predicates = [];

  // Exclude system-only master-admin accounts from all church-member results.
  if (member) predicates.push(buildChurchMemberClause(quoteIdentifier(member.alias)));

  const predicate = context.scope === 'all' ? null : scopePredicate(tables, context);
  if (context.scope !== 'all' && !predicate) {
    throw forbidden(
      `Your current role cannot access this result because it cannot be safely limited to ${context.scopeLabel.toLowerCase()}.`
    );
  }
  if (predicate) predicates.push(predicate);

  if (!predicates.length) return sql;

  const predicateAst = parser.astify(
    `SELECT 1 WHERE ${predicates.map(item => `(${item})`).join(' AND ')}`,
    { database: 'MySQL' }
  ).where;
  ast.where = ast.where
    ? { type: 'binary_expr', operator: 'AND', left: ast.where, right: predicateAst }
    : predicateAst;

  return parser.sqlify(ast, { database: 'MySQL' });
};

module.exports = { authorizeRagQuestion, authorizeGeneratedSQL };
