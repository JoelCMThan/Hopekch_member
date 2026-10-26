// Single source of truth for role identifiers and display labels.

export const ROLES = {
  MASTER_ADMIN:        'master_admin',
  ADMIN:               'admin',
  MANAGER:             'manager',
  SUBDISTRICT_LEADER:  'subdistrict_leader',
  UNIT_LEADER:         'unit_leader',
  ASSISTANT_UNIT_LEADER: 'assistantunit_leader',
  LG_LEADER:           'lg_leader',
  ASSISTANT_LG_LEADER: 'assistantlg_leader',
  CORE_TEAM:           'core_team',
  MEMBER:              'member',
};

/* All role strings */
export const ALL_ROLES = Object.values(ROLES);

/* Readable label for role string */
export const ROLE_LABELS = {
  [ROLES.MASTER_ADMIN]:        'Master Admin',
  [ROLES.ADMIN]:               'Admin',
  [ROLES.MANAGER]:             'Manager',
  [ROLES.SUBDISTRICT_LEADER]:  'Subdistrict Leader',
  [ROLES.UNIT_LEADER]:         'Unit Leader',
  [ROLES.ASSISTANT_UNIT_LEADER]: 'Assistant Unit Leader',
  [ROLES.LG_LEADER]:           'Life Group Leader',
  [ROLES.ASSISTANT_LG_LEADER]: 'Assistant Life Group Leader',
  [ROLES.CORE_TEAM]:           'Core Team',
  [ROLES.MEMBER]:              'Member',
};

export const getRoleLabel = (role) => ROLE_LABELS[role] ?? role;

/* Dashboard redirect path after login*/
export const getDashboardPath = () => '/dashboard';
