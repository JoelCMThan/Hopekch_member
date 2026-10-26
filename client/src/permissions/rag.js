import { ROLES } from './roles';
import { HIERARCHY } from './hierarchy';

export const RAG_ACCESS_ROLES = [
  ROLES.MASTER_ADMIN,
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.SUBDISTRICT_LEADER,
  ROLES.UNIT_LEADER,
  ROLES.ASSISTANT_UNIT_LEADER,
  ROLES.LG_LEADER,
  ROLES.ASSISTANT_LG_LEADER,
];

export const canAccessRagPage = (role) =>
  RAG_ACCESS_ROLES.includes(role);

/**
 * Get the data scope available to the role in RAG.
 *
 * master_admin / admin / manager -> all
 * subdistrict leader            -> own subdistrict
 * unit / assistant unit leader  -> own unit
 * LG / assistant LG leader      -> own life group
 */
export const getRagScope = (role) =>
  HIERARCHY[role]?.scope ?? null;