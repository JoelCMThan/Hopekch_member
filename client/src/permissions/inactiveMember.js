import { ROLES } from './roles';

export const INACTIVE_MEMBER_ACCESS_ROLES = [
  ROLES.MASTER_ADMIN, ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.SUBDISTRICT_LEADER,
  ROLES.UNIT_LEADER,
  ROLES.ASSISTANT_UNIT_LEADER,
  ROLES.LG_LEADER,
  ROLES.ASSISTANT_LG_LEADER,
];

export const canAccessInactiveMembersPage = (role) => {
  return INACTIVE_MEMBER_ACCESS_ROLES.includes(role);
};

export const canDeactivateMember = (role) => {
  return INACTIVE_MEMBER_ACCESS_ROLES.includes(role);
};

export const canActivateMember = (role) => {
  return INACTIVE_MEMBER_ACCESS_ROLES.includes(role);
};

export default {
  INACTIVE_MEMBER_ACCESS_ROLES,
  canAccessInactiveMembersPage,
  canDeactivateMember,
  canActivateMember,
};