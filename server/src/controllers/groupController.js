/**
 * server/src/controllers/groupController.js
 */

const {
  getGroups: repoGetGroups,
  getGroupById,
  createGroup: repoCreate,
  updateGroup: repoUpdate,
  deleteGroup: repoDelete,
  splitGroup: repoSplit,
  getGroupMembers: repoGetGroupMembers,
  getUnitsForGroups: repoGetUnitsForGroups,
} = require('../repositories/groupRepo');

const { success, error } = require('../utils/apiResponse');
const {
  canCreateGroups,
  canEditGroups,
  canDeleteGroups,
  canSplitGroups,
} = require('../utils/permissions');

/* GET /api/groups */
const getGroups = async (req, res) => {
  try {
    const { search, subdistrictId, unitId, page, limit } = req.query || {};

    const result = await repoGetGroups({
      user: req.user,
      exportAll: req.query.export === 'true',
      search: search || undefined,
      subdistrictId: subdistrictId ? Number(subdistrictId) : undefined,
      unitId: unitId ? Number(unitId) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return success(res, result, 'Groups retrieved');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* GET /api/groups/:id */
const getGroup = async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const group = await getGroupById(groupId);

    if (!group) {
      return error(res, 'Group not found', 404);
    }

    const members = await repoGetGroupMembers(groupId);

    return success(res, { ...group, members }, 'Group retrieved');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* POST /api/groups */
const createGroup = async (req, res) => {
  try {
    if (!canCreateGroups(req.user.role)) {
      return error(res, 'You do not have permission to create groups', 403);
    }

    const group = await repoCreate(req.body);

    return success(res, group, 'Group created', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* PUT /api/groups/:id */
const updateGroup = async (req, res) => {
  try {
    if (!canEditGroups(req.user.role)) {
      return error(res, 'You do not have permission to edit groups', 403);
    }

    const groupId = Number(req.params.id);
    const existing = await getGroupById(groupId);

    if (!existing) {
      return error(res, 'Group not found', 404);
    }

    const group = await repoUpdate(groupId, req.body);

    return success(res, group, 'Group updated');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* DELETE /api/groups/:id */
const deleteGroup = async (req, res) => {
  try {
    if (!canDeleteGroups(req.user.role)) {
      return error(res, 'You do not have permission to delete groups', 403);
    }

    const groupId = Number(req.params.id);
    const existing = await getGroupById(groupId);

    if (!existing) {
      return error(res, 'Group not found', 404);
    }

    await repoDelete(groupId);

    return success(res, null, 'Group deleted');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* POST /api/groups/:id/split */
const splitGroup = async (req, res) => {
  try {
    if (!canSplitGroups(req.user.role)) {
      return error(res, 'You do not have permission to split groups', 403);
    }

    const groupId = Number(req.params.id);
    const existing = await getGroupById(groupId);

    if (!existing) {
      return error(res, 'Group not found', 404);
    }

    const result = await repoSplit(groupId, req.body);

    return success(res, result, 'Group split successfully');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* GET /api/groups/lookup/units */
const getUnits = async (req, res) => {
  try {
    const units = await repoGetUnitsForGroups();

    return success(res, units, 'Units retrieved');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

const getSubdistricts = async (req, res) => {
  try {
    const [rows] = await require('../config/db').pool.execute(
      'SELECT SubdistrictID, SubdistrictName FROM Subdistrict ORDER BY SubdistrictName'
    );
    return success(res, rows, 'Subdistricts retrieved');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

module.exports = {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  splitGroup,
  getUnits,
  getSubdistricts,
};
