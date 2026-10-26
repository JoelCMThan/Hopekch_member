const organizationRepo = require('../repositories/organizationRepo');
/**
 * server/src/controllers/unitController.js
 */

const {
  getUnits: repoGetUnits,
  getUnitById,
  createUnit: repoCreate,
  updateUnit: repoUpdate,
  deleteUnit: repoDelete,
  getSubdistricts: repoGetSubdistricts,
} = require('../repositories/unitRepo');

const { success, error } = require('../utils/apiResponse');

const {
  canCreateUnits,
  canEditUnits,
  canDeleteUnits,
} = require('../utils/permissions');


/* GET /api/units */
const getUnits = async (req, res) => {
  try {
    const {
      search,
      subdistrictId,
      page,
      limit,
    } = req.query;

    const result = await repoGetUnits({
      user: req.user,
      exportAll: req.query.export === 'true',
      search: search || undefined,
      subdistrictId: subdistrictId ? Number(subdistrictId) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return success(res, result, 'Units retrieved');
  } catch (err) {
    return error(res, err.message, 500);
  }
};


/* GET /api/units/:id */
const getUnit = async (req, res) => {
  try {
    const unitId = Number(req.params.id);

    const unit = await getUnitById(unitId);

    if (!unit) {
      return error(res, 'Unit not found', 404);
    }

    return success(res, { ...unit, children: await organizationRepo.getChildren('unit', unitId) }, 'Unit retrieved');
  } catch (err) {
    return error(res, err.message, 500);
  }
};


/* POST /api/units */
const createUnit = async (req, res) => {
  try {
    if (!canCreateUnits(req.user.role)) {
      return error(res, 'You do not have permission to create units', 403);
    }

    const unit = await repoCreate(req.body);

    return success(res, unit, 'Unit created', 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};


/* PUT /api/units/:id */
const updateUnit = async (req, res) => {
  try {
    if (!canEditUnits(req.user.role)) {
      return error(res, 'You do not have permission to edit units', 403);
    }

    const unitId = Number(req.params.id);

    const existing = await getUnitById(unitId);

    if (!existing) {
      return error(res, 'Unit not found', 404);
    }

    const unit = await repoUpdate(unitId, req.body);

    return success(res, unit, 'Unit updated');
  } catch (err) {
    return error(res, err.message, 500);
  }
};


/* DELETE /api/units/:id */
const deleteUnit = async (req, res) => {
  try {
    if (!canDeleteUnits(req.user.role)) {
      return error(res, 'You do not have permission to delete units', 403);
    }

    const unitId = Number(req.params.id);

    const existing = await getUnitById(unitId);

    if (!existing) {
      return error(res, 'Unit not found', 404);
    }

    await repoDelete(unitId);

    return success(res, null, 'Unit deleted');
  } catch (err) {
    return error(res, err.message, 500);
  }
};


/* GET /api/units/lookup/subdistricts */
const getSubdistricts = async (req, res) => {
  try {
    const subdistricts = await repoGetSubdistricts();

    return success(res, subdistricts, 'Subdistricts retrieved');
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = {
  getUnits,
  getUnit,
  createUnit,
  updateUnit,
  deleteUnit,
  getSubdistricts,
};