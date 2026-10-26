const repo = require('../repositories/organizationRepo');
const permissions = require('../utils/permissions');
const { success, error } = require('../utils/apiResponse');

const checkScope = kind => async (req, res, next) => {
  try {
    await repo.assertAccessible(kind, Number(req.params.id), req.user);
    next();
  } catch (err) { return error(res, err.message, err.status || 500); }
};

const changeStatus = (kind, active) => async (req, res) => {
  const canEdit = { group: permissions.canEditGroups, unit: permissions.canEditUnits, subdistrict: permissions.canEditSubdistricts }[kind];
  if (!canEdit(req.user.role)) return error(res, 'You do not have permission to change this status', 403);
  try {
    await repo.setStatus(kind, Number(req.params.id), req.user, active);
    return success(res, { IsActive: active }, active ? 'Activated successfully' : 'Inactivated successfully');
  } catch (err) { return error(res, err.message, err.status || 500); }
};

module.exports = { checkScope, changeStatus };
