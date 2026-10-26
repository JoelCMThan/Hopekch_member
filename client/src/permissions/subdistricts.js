import { ROLES } from './roles';
import { canPerform } from './hierarchy';

export const SUBDISTRICTS_ACCESS_ROLES = [
  ROLES.MASTER_ADMIN, ROLES.ADMIN,
  ROLES.MANAGER,
];

export const canAccessSubdistrictsPage = (role) =>
  SUBDISTRICTS_ACCESS_ROLES.includes(role);

export const canCreateSubdistrict = (role) =>
  canAccessSubdistrictsPage(role) && canPerform(role, 'create');

export const canEditSubdistrict = (role) =>
  canAccessSubdistrictsPage(role) && canPerform(role, 'edit');

export const canDeleteSubdistrict = (role) =>
  canAccessSubdistrictsPage(role) && canPerform(role, 'delete');