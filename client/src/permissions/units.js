import { ROLES } from './roles';

export const UNITS_ACCESS_ROLES = [
  ROLES.MASTER_ADMIN, ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.SUBDISTRICT_LEADER,
];


export const canAccessUnitsPage = (role) =>
  UNITS_ACCESS_ROLES.includes(role);


export const canCreateUnit = (role) =>
  [
    ROLES.MASTER_ADMIN, ROLES.ADMIN,
    ROLES.MANAGER,
    ROLES.SUBDISTRICT_LEADER,
  ].includes(role);


export const canEditUnit = (role) =>
  [
    ROLES.MASTER_ADMIN, ROLES.ADMIN,
    ROLES.MANAGER,
    ROLES.SUBDISTRICT_LEADER,
  ].includes(role);


export const canDeleteUnit = (role) =>
  [
    ROLES.MASTER_ADMIN, ROLES.ADMIN,
    ROLES.MANAGER,
  ].includes(role);

export const canSeeUnitSubdistrictFilter = (role) =>
  [
    ROLES.MASTER_ADMIN, ROLES.ADMIN,
    ROLES.MANAGER,
  ].includes(role);