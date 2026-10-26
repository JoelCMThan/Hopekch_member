import { ROLES } from './roles';
import { canPerform } from './hierarchy';

export const GROUPS_ACCESS_ROLES = [
  ROLES.MASTER_ADMIN, ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.SUBDISTRICT_LEADER,
  ROLES.UNIT_LEADER,
  ROLES.ASSISTANT_UNIT_LEADER,
];

export const canAccessGroupsPage = (role) =>
  GROUPS_ACCESS_ROLES.includes(role);

export const canCreateGroup = (role) =>
  canAccessGroupsPage(role) && canPerform(role, 'create');


export const canDeleteGroup = (role) =>
  canAccessGroupsPage(role) && canPerform(role, 'delete');

export const canSplitGroup = (role) =>
  [
    ROLES.MASTER_ADMIN, ROLES.ADMIN,
    ROLES.MANAGER,
    ROLES.SUBDISTRICT_LEADER,
    ROLES.UNIT_LEADER,
    ROLES.ASSISTANT_UNIT_LEADER,
  ].includes(role);

export const canSeeGroupUnitFilter = (role) =>
  [ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.SUBDISTRICT_LEADER].includes(role);

export const canEditGroup = (role) => canAccessGroupsPage(role) && canPerform(role, 'edit');
