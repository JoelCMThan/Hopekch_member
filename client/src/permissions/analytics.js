import { ROLES } from './roles';

export const ANALYTICS_ACCESS_ROLES = [
  ROLES.MASTER_ADMIN, ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.SUBDISTRICT_LEADER,
];

export const canAccessAnalyticsPage = (role) =>
  ANALYTICS_ACCESS_ROLES.includes(role);