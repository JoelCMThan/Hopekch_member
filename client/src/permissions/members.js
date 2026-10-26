import { ROLES, getRoleLabel } from './roles';
import {
  canPerform,
  getVisibleRolesByHierarchy,
  getAssignableRolesByHierarchy,
} from './hierarchy';

/* ── Members module access control ───────────────────────────── */

export const MEMBERS_ACCESS_ROLES = Object.values(ROLES).filter((role) =>
  canPerform(role, 'access')
);

export const canAccessMembersPage = (role) =>
  canPerform(role, 'access');

export const canCreateMember = (role) =>
  canPerform(role, 'create');

export const canManageBulkImport = (role) =>
  [ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER].includes(role);

export const canBulkImportMembers = canManageBulkImport;

export const canEditMember = (role) =>
  canPerform(role, 'edit');

export const canDeleteMember = (role) =>
  canPerform(role, 'delete');

export const canMarkInactive = (role) =>
  canPerform(role, 'markInactive');

export const canSelfEdit = (role, isSelf) =>
  [ROLES.CORE_TEAM, ROLES.MEMBER].includes(role) && isSelf;

export const canSeeBelieverStatus = (role, isSelf) =>
  !isSelf && [
    ROLES.MASTER_ADMIN, ROLES.ADMIN,
    ROLES.MANAGER,
    ROLES.SUBDISTRICT_LEADER,
    ROLES.UNIT_LEADER,
    ROLES.ASSISTANT_UNIT_LEADER,
    ROLES.LG_LEADER,
    ROLES.ASSISTANT_LG_LEADER,
  ].includes(role);

/**
 * - Manager: can reset anyone's password
 * - Admin: can reset anyone's password
 * - Leaders: can reset passwords of members in their scope
 */
export const canManageMember = (actorRole, targetRole) =>
  actorRole === ROLES.MASTER_ADMIN || targetRole !== ROLES.MASTER_ADMIN;

export const canResetPassword = (actorRole, targetRole = null) => {
  if (!canManageMember(actorRole, targetRole) || !canEditMember(actorRole)) return false;
  return true;
};

/* ── Form field visibility by role ───────────────────────────── */

export const canSetSubdistrict = (role) =>
  canPerform(role, 'setSubdistrict');

export const canSetUnit = (role) =>
  canPerform(role, 'setUnit');

export const canSetLifeGroup = (role) =>
  canPerform(role, 'setLifeGroup');

/* ── Filter visibility ───────────────────────────── */

/**
 * Show the Unit filter to roles that can access multiple units.
 */
const UNIT_FILTER_ROLES = [
  ROLES.SUBDISTRICT_LEADER,
  ROLES.MANAGER,
  ROLES.MASTER_ADMIN, ROLES.ADMIN,
];
export const canSeeUnitFilter = (role) => UNIT_FILTER_ROLES.includes(role);

/**
 * Show the Life Group filter to roles that can access multiple life groups.
 */
const LG_FILTER_ROLES = [
  ROLES.UNIT_LEADER,
  ROLES.ASSISTANT_UNIT_LEADER,
  ROLES.SUBDISTRICT_LEADER,
  ROLES.MANAGER,
  ROLES.MASTER_ADMIN, ROLES.ADMIN,
];
export const canSeeLifeGroupFilter = (role) => LG_FILTER_ROLES.includes(role);

/* ── Role options ───────────────────────────── */

export const getVisibleRoleOptions = (role) =>
  getVisibleRolesByHierarchy(role)
    .map((value) => ({ value, label: getRoleLabel(value) }));

export const getAssignableRoleOptions = (role) =>
  getAssignableRolesByHierarchy(role)
    .map((value) => ({ value, label: getRoleLabel(value) }));
