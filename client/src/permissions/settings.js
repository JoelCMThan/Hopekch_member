import { ROLES } from './roles';

export const SETTINGS_ACCESS_ROLES = [
  ROLES.MASTER_ADMIN,
  ROLES.ADMIN,
  ROLES.MANAGER,
];

export const canAccessSettingsPage = role => SETTINGS_ACCESS_ROLES.includes(role);
