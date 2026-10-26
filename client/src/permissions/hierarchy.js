import { ROLES } from './roles';

/**
 * Role hierarchy with scope level and managed entity.
 * Level -1 = master admin, Level 0 = admin, Level 5 = lowest.
 */
export const HIERARCHY = {
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
 * Roles can perform all actions up to and including their level.
 */
export const ACTIONS_BY_LEVEL = {
  [-1]: ['access', 'create', 'edit', 'delete', 'markInactive', 'setSubdistrict', 'setUnit', 'setLifeGroup'],
  0: ['access', 'create', 'edit', 'delete', 'markInactive', 'setSubdistrict', 'setUnit', 'setLifeGroup'],
  1: ['access', 'create', 'edit', 'delete', 'markInactive', 'setSubdistrict', 'setUnit', 'setLifeGroup'],
  2: ['access', 'create', 'edit', 'markInactive', 'setUnit', 'setLifeGroup'],
  3: ['access', 'create', 'edit', 'markInactive', 'setLifeGroup'],
  4: ['access', 'create', 'edit', 'markInactive'],
  5: [],
};

/**
 * Visible roles (in dropdowns, etc.) for each hierarchy level.
 * Each role can see roles at or below their level (higher level numbers).
 */
export const VISIBLE_ROLES_BY_LEVEL = {
  [-1]: Object.values(ROLES),
  0: Object.values(ROLES).filter(role => role !== ROLES.MASTER_ADMIN),
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
    ROLES.ASSISTANT_UNIT_LEADER,
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

/**
 * Assignable roles for role assignment per hierarchy level.
 * Same as VISIBLE_ROLES_BY_LEVEL.
 */
export const ASSIGNABLE_ROLES_BY_LEVEL = VISIBLE_ROLES_BY_LEVEL;

/**
 * Scope labels for each hierarchy level.
 */
export const SCOPE_LABELS_BY_LEVEL = {
  [-1]: 'All members in the system',
  0: 'All members in the system',
  1: 'All members in the system',
  2: 'Members in your subdistrict',
  3: 'Members in your unit',
  4: 'Members in your life group',
  5: 'Your own profile',
};

/**
 * Check if a role can perform a given action.
 */
export const canPerform = (role, action) => {
  const hierarchy = HIERARCHY[role];
  if (!hierarchy) return false;
  return ACTIONS_BY_LEVEL[hierarchy.level]?.includes(action) ?? false;
};

/**
 * Get the managed entity type for a role.
 */
export const getManagedEntity = (role) => HIERARCHY[role]?.managedEntity;

/**
 * Get the hierarchy level for a role.
 */
export const getHierarchyLevel = (role) => HIERARCHY[role]?.level;

/**
 * Get visible roles for a given role.
 */
export const getVisibleRolesByHierarchy = (role) => {
  const level = getHierarchyLevel(role);
  return VISIBLE_ROLES_BY_LEVEL[level] ?? [];
};

/**
 * Get assignable roles for a given role.
 */
export const getAssignableRolesByHierarchy = (role) => {
  const level = getHierarchyLevel(role);
  return ASSIGNABLE_ROLES_BY_LEVEL[level] ?? [];
};

/**
 * Get the scope label for a given role.
 */
export const getScopeLabelByHierarchy = (role) => {
  const level = getHierarchyLevel(role);
  return SCOPE_LABELS_BY_LEVEL[level] ?? 'Unknown scope';
};
