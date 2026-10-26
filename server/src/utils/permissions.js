const ROLES = {
  MASTER_ADMIN:        'master_admin',
  ADMIN:               'admin',
  MANAGER:             'manager',
  SUBDISTRICT_LEADER:  'subdistrict_leader',
  UNIT_LEADER:         'unit_leader',
  ASSISTANT_UNIT_LEADER: 'assistantunit_leader',
  LG_LEADER:           'lg_leader',
  ASSISTANT_LG_LEADER: 'assistantlg_leader',
  CORE_TEAM:           'core_team',
  MEMBER:              'member',
};

const ALL_ROLES = Object.values(ROLES);

/**
 * Role hierarchy with scope level and managed entity.
 * Level -1 = master admin, Level 0 = admin, Level 5 = lowest.
 */
const HIERARCHY = {
  [ROLES.MASTER_ADMIN]: {
    level: -1,
    scope: 'all',
    managedEntity: null,
  },
  [ROLES.ADMIN]: {
    level: 0,
    scope: 'all',
    managedEntity: null,
  },
  [ROLES.MANAGER]: {
    level: 1,
    scope: 'all',
    managedEntity: null,
  },
  [ROLES.SUBDISTRICT_LEADER]: {
    level: 2,
    scope: 'subdistrict',
    managedEntity: 'subdistrict',
  },
  [ROLES.UNIT_LEADER]: {
    level: 3,
    scope: 'unit',
    managedEntity: 'unit',
  },
  [ROLES.ASSISTANT_UNIT_LEADER]: {
    level: 3,
    scope: 'unit',
    managedEntity: 'unit',
  },
  [ROLES.LG_LEADER]: {
    level: 4,
    scope: 'lifeGroup',
    managedEntity: 'lifeGroup',
  },
  [ROLES.ASSISTANT_LG_LEADER]: {
    level: 4,
    scope: 'lifeGroup',
    managedEntity: 'lifeGroup',
  },
  [ROLES.CORE_TEAM]: {
    level: 5,
    scope: 'self',
    managedEntity: null,
  },
  [ROLES.MEMBER]: {
    level: 5,
    scope: 'self',
    managedEntity: null,
  },
};

/**
 * Actions available per hierarchy level.
 */
const ACTIONS_BY_LEVEL = {
  [-1]: ['access', 'create', 'edit', 'delete', 'markInactive', 'setSubdistrict', 'setUnit', 'setLifeGroup'],
  0: ['access', 'create', 'edit', 'delete', 'markInactive', 'setSubdistrict', 'setUnit', 'setLifeGroup'],
  1: ['access', 'create', 'edit', 'delete', 'markInactive', 'setSubdistrict', 'setUnit', 'setLifeGroup'],
  2: ['access', 'create', 'edit', 'markInactive', 'setUnit', 'setLifeGroup'],
  3: ['access', 'create', 'edit', 'markInactive', 'setLifeGroup'],
  4: ['access', 'create', 'edit', 'markInactive'],
  5: [],
};

/**
 * Visible roles per hierarchy level.
 */
const VISIBLE_ROLES_BY_LEVEL = {
  [-1]: ALL_ROLES,
  0: ALL_ROLES.filter(role => role !== ROLES.MASTER_ADMIN),
  1: [
    ROLES.MANAGER,
    ROLES.SUBDISTRICT_LEADER,
    ROLES.UNIT_LEADER,
    ROLES.ASSISTANT_UNIT_LEADER,
    ROLES.LG_LEADER,
    ROLES.ASSISTANT_LG_LEADER,
    ROLES.CORE_TEAM,
    ROLES.MEMBER,
  ],
  2: [
    ROLES.SUBDISTRICT_LEADER,
    ROLES.UNIT_LEADER,
    ROLES.ASSISTANT_UNIT_LEADER,
    ROLES.LG_LEADER,
    ROLES.ASSISTANT_LG_LEADER,
    ROLES.CORE_TEAM,
    ROLES.MEMBER,
  ],
  3: [
    ROLES.UNIT_LEADER,
    ROLES.LG_LEADER,
    ROLES.ASSISTANT_LG_LEADER,
    ROLES.CORE_TEAM,
    ROLES.MEMBER,
  ],
  4: [
    ROLES.LG_LEADER,
    ROLES.ASSISTANT_LG_LEADER,
    ROLES.CORE_TEAM,
    ROLES.MEMBER,
  ],
  5: [ROLES.CORE_TEAM, ROLES.MEMBER],
};

const SCOPE_LABELS = {
  [-1]: 'All members in the system',
  0: 'All members in the system',
  1: 'All members in the system',
  2: 'Members in your subdistrict',
  3: 'Members in your unit',
  4: 'Members in your life group',
  5: 'Your own profile',
};

/**
 * Core hierarchy helpers.
 */
const getHierarchyLevel = (role) => HIERARCHY[role]?.level;
const getHierarchyScope = (role) => HIERARCHY[role]?.scope;
const getManagedEntity = (role) => HIERARCHY[role]?.managedEntity;

const canPerform = (role, action) => {
  const level = getHierarchyLevel(role);
  if (level === undefined) return false;
  return ACTIONS_BY_LEVEL[level]?.includes(action) ?? false;
};

/**
 * Module-specific helpers.
 */
const isMembersModuleRole = (role) => canPerform(role, 'access');
const canCreateMembers = (role) => canPerform(role, 'create');
const canEditMembers = (role) => canPerform(role, 'edit');
const canDeleteMembers = (role) => canPerform(role, 'delete');
const canMarkInactive = (role) => canPerform(role, 'markInactive');
const canManageBulkImport = (role) =>
  [ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER].includes(role);
const canBulkImportMembers = canManageBulkImport;

const canAccessMembersModule = (role) => isMembersModuleRole(role);
const getVisibleRolesFor = (role) => {
  const level = getHierarchyLevel(role);
  return VISIBLE_ROLES_BY_LEVEL[level] ?? [ROLES.CORE_TEAM, ROLES.MEMBER];
};
const getAssignableRolesFor = (role) => getVisibleRolesFor(role);
const getValidRoles = () => ALL_ROLES;
const canSelfEdit = (role, isSelf) => [ROLES.CORE_TEAM, ROLES.MEMBER].includes(role) && isSelf;

const getRoleScope = (role) => getHierarchyScope(role) || 'self';

const getScopeLabel = (role) => {
  const level = getHierarchyLevel(role);
  return SCOPE_LABELS[level] ?? 'Unknown scope';
};

/**
 * A master admin is a system account, not a church member. 
 */
const buildChurchMemberClause = (memberAlias = 'm') =>
  `NOT EXISTS (
    SELECT 1
    FROM \`User\` systemUser
    WHERE systemUser.MemberID = ${memberAlias}.MemberID
      AND systemUser.Role = '${ROLES.MASTER_ADMIN}'
  )`;

const buildScopeClause = (user) => {
  const { role, memberId } = user;

  if (role === ROLES.MASTER_ADMIN || role === ROLES.ADMIN || role === ROLES.MANAGER) {
    return { clause: '', params: [] };
  }

  const visibleRoles = VISIBLE_ROLES_BY_LEVEL[getHierarchyLevel(role)] ?? [ROLES.CORE_TEAM, ROLES.MEMBER];
  const visibilityClause = `AND (usr.Role IN (${visibleRoles.map(() => '?').join(', ')}) OR usr.Role IS NULL)`;
  const visibilityParams = [...visibleRoles];

  if (role === ROLES.SUBDISTRICT_LEADER) {
    return {
      clause: `AND ut.SubdistrictID IN (
        SELECT leadership.ScopeID
        FROM Leadership leadership
        INNER JOIN ScopeType scopeType ON scopeType.ScopeTypeID = leadership.ScopeTypeID
        WHERE leadership.MemberID = ?
          AND leadership.IsActiveLeader = TRUE
          AND scopeType.ScopeName = 'Subdistrict')` + ` ${visibilityClause}`,
      params: [memberId, ...visibilityParams],
    };
  }

  if (role === ROLES.UNIT_LEADER || role === ROLES.ASSISTANT_UNIT_LEADER) {
    return {
      clause: `AND lg.UnitID IN (
        SELECT leadership.ScopeID
        FROM Leadership leadership
        INNER JOIN ScopeType scopeType ON scopeType.ScopeTypeID = leadership.ScopeTypeID
        WHERE leadership.MemberID = ?
          AND leadership.IsActiveLeader = TRUE
          AND scopeType.ScopeName = 'Unit')`,
      params: [memberId],
    };
  }

  if (role === ROLES.LG_LEADER || role === ROLES.ASSISTANT_LG_LEADER) {
    return {
      clause: `AND m.LifeGroupID = (
        SELECT m2.LifeGroupID FROM Member m2
        INNER JOIN \`User\` u2 ON u2.MemberID = m2.MemberID
        WHERE u2.MemberID = ? LIMIT 1)`,
      params: [memberId],
    };
  }
  if ([ROLES.CORE_TEAM, ROLES.MEMBER].includes(role)) {
    return { clause: 'AND m.MemberID = ?', params: [memberId] };
  }
  return { clause: 'AND 1 = 0', params: [] };
};

/**
 * Groups module helpers.
 */
const GROUPS_MODULE_ROLES = [ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.SUBDISTRICT_LEADER, ROLES.UNIT_LEADER, ROLES.ASSISTANT_UNIT_LEADER];

const canAccessGroupsModule = (role) => GROUPS_MODULE_ROLES.includes(role);
const canCreateGroups = (role) => GROUPS_MODULE_ROLES.includes(role) && canPerform(role, 'create');
const canEditGroups = (role) => GROUPS_MODULE_ROLES.includes(role) && canPerform(role, 'edit');
const canDeleteGroups = (role) => [ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER].includes(role);
const canSplitGroups = (role) => GROUPS_MODULE_ROLES.includes(role);

const buildGroupScopeClause = (user) => {
  const { role, memberId } = user;

  if (role === ROLES.MASTER_ADMIN || role === ROLES.ADMIN || role === ROLES.MANAGER) {
    return { clause: '', params: [] };
  }

  if (role === ROLES.SUBDISTRICT_LEADER) {
    // Active Leadership rows are authoritative even when the leader has no
    // personal life-group membership.
    return {
      clause: `AND u.SubdistrictID IN (
        SELECT leadership.ScopeID
        FROM Leadership leadership
        INNER JOIN ScopeType scopeType ON scopeType.ScopeTypeID = leadership.ScopeTypeID
        WHERE leadership.MemberID = ?
          AND leadership.IsActiveLeader = TRUE
          AND scopeType.ScopeName = 'Subdistrict')`,
      params: [memberId],
    };
  }

  if (role === ROLES.UNIT_LEADER || role === ROLES.ASSISTANT_UNIT_LEADER) {
    // Unit leaders do not need to belong to a life group. Their active
    // Leadership rows are the authoritative unit scope.
    return {
      clause: `AND g.UnitID IN (
        SELECT leadership.ScopeID
        FROM Leadership leadership
        INNER JOIN ScopeType scopeType ON scopeType.ScopeTypeID = leadership.ScopeTypeID
        WHERE leadership.MemberID = ?
          AND leadership.IsActiveLeader = TRUE
          AND scopeType.ScopeName = 'Unit')`,
      params: [memberId],
    };
  }

  return { clause: 'AND 1 = 0', params: [] };
};


/**
 * Units module helpers.
 */
const UNITS_MODULE_ROLES = [ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.SUBDISTRICT_LEADER];

const canAccessUnitsModule = (role) => UNITS_MODULE_ROLES.includes(role);
const canCreateUnits = (role) => canAccessUnitsModule(role) && canPerform(role, 'create');
const canEditUnits = (role) => canAccessUnitsModule(role) && canPerform(role, 'edit');
const canDeleteUnits = (role) => canAccessUnitsModule(role) && canPerform(role, 'delete');

const buildUnitScopeClause = (user) => {
  const { role, memberId } = user;

  if (
    role === ROLES.MASTER_ADMIN || role === ROLES.ADMIN ||
    role === ROLES.MANAGER
  ) {
    return {
      clause: '',
      params: [],
    };
  }

  if (role === ROLES.SUBDISTRICT_LEADER) {
    return {
      clause: `
        AND u.SubdistrictID IN (
          SELECT leadership.ScopeID
          FROM Leadership leadership
          INNER JOIN ScopeType scopeType ON scopeType.ScopeTypeID = leadership.ScopeTypeID
          WHERE leadership.MemberID = ?
            AND leadership.IsActiveLeader = TRUE
            AND scopeType.ScopeName = 'Subdistrict'
        )
      `,
      params: [
        memberId
      ],
    };
  }

  return {
    clause: 'AND 1 = 0',
    params: [],
  };
};

/**
 * Subdistricts module helpers.
 */
const SUBDISTRICTS_MODULE_ROLES = [ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER];

const canAccessSubdistrictsModule = (role) => SUBDISTRICTS_MODULE_ROLES.includes(role);
const canCreateSubdistricts = (role) => canAccessSubdistrictsModule(role) && canPerform(role, 'create');
const canEditSubdistricts = (role) => canAccessSubdistrictsModule(role) && canPerform(role, 'edit');
const canDeleteSubdistricts = (role) => SUBDISTRICTS_MODULE_ROLES.includes(role) && canPerform(role, 'delete');

const buildSubdistrictScopeClause = (user) => {
  const { role } = user;

  if (
    role === ROLES.MASTER_ADMIN || role === ROLES.ADMIN ||
    role === ROLES.MANAGER
  ) {
    return {
      clause: '',
      params: [],
    };
  }

  return {
    clause: 'AND 1 = 0',
    params: [],
  };
};

/**
 * Inactive Members module helpers
 */

const INACTIVE_MEMBERS_MODULE_ROLES = [
  ROLES.MASTER_ADMIN, ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.SUBDISTRICT_LEADER,
  ROLES.UNIT_LEADER,
  ROLES.ASSISTANT_UNIT_LEADER,
  ROLES.LG_LEADER,
  ROLES.ASSISTANT_LG_LEADER,
];

const canAccessInactiveMembersModule = (role) =>
  INACTIVE_MEMBERS_MODULE_ROLES.includes(role);

/**
 * Deactivate permission
 *
 * Leaders can deactivate only within their scope.
 * Scope filtering is handled by repository.
 */
const canDeactivateMembers = (role) =>
  INACTIVE_MEMBERS_MODULE_ROLES.includes(role);

const canActivateMembers = (role) =>
[
  ROLES.MASTER_ADMIN, ROLES.ADMIN,
  ROLES.MANAGER,
].includes(role);

/**
 * Communication Service module helpers
 */
const COMMUNICATION_MODULE_ROLES = [
  ROLES.MASTER_ADMIN, ROLES.ADMIN,
  ROLES.MANAGER,
];

/**
 * Check whether the user can access
 * the communication module.
 */
const canAccessCommunicationModule = (role) => 
  COMMUNICATION_MODULE_ROLES.includes(role);

/**
 * Analytics module helpers
 */
const ANALYTICS_MODULE_ROLES = [
  ROLES.MASTER_ADMIN, ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.SUBDISTRICT_LEADER,
];

const canAccessAnalyticsModule = (role) =>
  ANALYTICS_MODULE_ROLES.includes(role);

/**
 * RAG module helpers. RAG uses the same hierarchy as member visibility, but
 * excludes self-only roles because free-form database queries cannot be made
 * useful for them without exposing broader data.
 */
const RAG_MODULE_ROLES = [
  ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER,
  ROLES.SUBDISTRICT_LEADER,
  ROLES.UNIT_LEADER, ROLES.ASSISTANT_UNIT_LEADER,
  ROLES.LG_LEADER, ROLES.ASSISTANT_LG_LEADER,
];

const canAccessRagModule = (role) => RAG_MODULE_ROLES.includes(role);

/**
 * Check if the actor can assign a specific role to a target user.
 */
const canAssignRole = (actorRole, targetRole) => {
  // Must be able to edit members
  if (!canEditMembers(actorRole)) {
    return { allowed: false, reason: 'You do not have permission to assign roles' };
  }

  // Get hierarchy info
  const actorLevel = getHierarchyLevel(actorRole);
  const targetLevel = getHierarchyLevel(targetRole);

  if (actorLevel === undefined || targetLevel === undefined) {
    return { allowed: false, reason: 'Invalid role specified' };
  }

  // Higher-level roles can only assign roles at the same or lower level.
  // Example: admin (level 0) can determine manager, subdistrict leader, unit leader, LG leader, assistant LG leader, core team, member.
  if (targetLevel < actorLevel) {
    return { allowed: false, reason: 'You can only assign roles at or below your hierarchy level' };
  }

  // Actor can only assign roles they can see (roles at or below their level)
  const visibleRoles = getVisibleRolesFor(actorRole);
  if (!visibleRoles.includes(targetRole)) {
    return { allowed: false, reason: 'You cannot assign this role' };
  }

  return { allowed: true };
};

// Master admin accounts can only be changed by another master admin.
const canManageMember = (actorRole, targetRole) =>
  actorRole === ROLES.MASTER_ADMIN || targetRole !== ROLES.MASTER_ADMIN;

module.exports = {
  canManageMember,
  ROLES,
  ALL_ROLES,
  VALID_ROLES: ALL_ROLES,
  HIERARCHY,
  ACTIONS_BY_LEVEL,
  VISIBLE_ROLES_BY_LEVEL,
  SCOPE_LABELS,
  // Core helpers
  getHierarchyLevel,
  getHierarchyScope,
  getManagedEntity,
  canPerform,
  canAssignRole,
  // Members module helpers
  MEMBERS_MODULE_ROLES: ALL_ROLES.filter(role => isMembersModuleRole(role)),
  isMembersModuleRole,
  canCreateMembers,
  canEditMembers,
  canDeleteMembers,
  canMarkInactive,
  canManageBulkImport,
  canBulkImportMembers,
  canAccessMembersModule,
  // Groups module helpers
  GROUPS_MODULE_ROLES,
  canAccessGroupsModule,
  canCreateGroups,
  canEditGroups,
  canDeleteGroups,
  canSplitGroups,
  buildGroupScopeClause,
  // Units module helpers
  UNITS_MODULE_ROLES,
  canAccessUnitsModule,
  canCreateUnits,
  canEditUnits,
  canDeleteUnits,
  buildUnitScopeClause,
  // Subdistricts module helpers
  SUBDISTRICTS_MODULE_ROLES,
  canAccessSubdistrictsModule,
  canCreateSubdistricts,
  canEditSubdistricts,
  canDeleteSubdistricts,
  buildSubdistrictScopeClause,
  // Inactive Members module helpers
  INACTIVE_MEMBERS_MODULE_ROLES,
  canAccessInactiveMembersModule,
  canDeactivateMembers,
  canActivateMembers,
  // Communication Service odule helpers 
  COMMUNICATION_MODULE_ROLES, 
  canAccessCommunicationModule,
  // Shared helpers
  getVisibleRolesFor,
  getAssignableRolesFor,
  getValidRoles,
  canSelfEdit,
  getRoleScope,
  getScopeLabel,
  buildChurchMemberClause,
  buildScopeClause,
  // Analytics module helpers
  ANALYTICS_MODULE_ROLES,
  canAccessAnalyticsModule,
  // RAG module helpers
  RAG_MODULE_ROLES,
  canAccessRagModule,
};
