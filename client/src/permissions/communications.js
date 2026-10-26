import {ROLES} from './roles';

export const COMMUNICATION_ACCESS_ROLES = [
    ROLES.MASTER_ADMIN, ROLES.ADMIN,
    ROLES.MANAGER
];

export const canAccessCommunicationsPage = (role) => 
  COMMUNICATION_ACCESS_ROLES.includes(role);
