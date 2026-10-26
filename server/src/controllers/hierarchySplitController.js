const repo = require('../repositories/hierarchySplitRepo');
const { canCreateUnits, canEditUnits, canCreateSubdistricts, canEditSubdistricts } = require('../utils/permissions');
const { success, error } = require('../utils/apiResponse');

const splitHandler = (kind, optionsOnly = false) => async (req, res) => {
  const allowed = kind === 'unit'
    ? canCreateUnits(req.user.role) && canEditUnits(req.user.role)
    : canCreateSubdistricts(req.user.role) && canEditSubdistricts(req.user.role);
  if (!allowed) return error(res, 'You do not have permission to split this structure', 403);
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return error(res, 'Invalid source ID', 400);
  try {
    const result = optionsOnly
      ? await repo.getSplitOptions(kind, id, req.user)
      : await repo.splitHierarchy(kind, id, req.user, req.body);
    return success(res, result, optionsOnly ? 'Split options retrieved' : 'Split completed', optionsOnly ? 200 : 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

module.exports = { splitHandler };
