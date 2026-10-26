const organizationRepo = require('../repositories/organizationRepo');
const {
  getSubdistricts: repoGetSubdistricts,
  getSubdistrictById,
  createSubdistrict: repoCreate,
  updateSubdistrict: repoUpdate,
  deleteSubdistrict: repoDelete,
} = require('../repositories/subdistrictRepo');

const { success, error } = require('../utils/apiResponse');

const {
  canCreateSubdistricts,
  canEditSubdistricts,
  canDeleteSubdistricts,
} = require('../utils/permissions');

/* GET /api/subdistricts */
const getSubdistricts = async (req, res) => {
  try {
    const { search, page, limit } = req.query || {};

    const result = await repoGetSubdistricts({
      user: req.user,
      search: search || undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return success(res, result, 'Subdistricts retrieved');
  } catch (err) {
    return error(res, err.message, 500);
  }
};

/* GET /api/subdistricts/:id */
const getSubdistrict = async (req, res) => {
  try {
    const subdistrictId = Number(req.params.id);

    const subdistrict = await getSubdistrictById(subdistrictId);

    if (!subdistrict) {
      return error(res, 'Subdistrict not found', 404);
    }

    return success(res, { ...subdistrict, children: await organizationRepo.getChildren('subdistrict', subdistrictId) }, 'Subdistrict retrieved');
  } catch (err) {
    return error(res, err.message, 500);
  }
};

/* POST /api/subdistricts */
const createSubdistrict = async (req, res) => {
  try {
    if (!canCreateSubdistricts(req.user.role)) {
      return error(
        res,
        'You do not have permission to create subdistricts',
        403
      );
    }

    const subdistrict = await repoCreate(req.body);

    return success(
      res,
      subdistrict,
      'Subdistrict created',
      201
    );
  } catch (err) {
    return error(res, err.message, 500);
  }
};

/* PUT /api/subdistricts/:id */
const updateSubdistrict = async (req, res) => {
  try {
    if (!canEditSubdistricts(req.user.role)) {
      return error(
        res,
        'You do not have permission to edit subdistricts',
        403
      );
    }

    const subdistrictId = Number(req.params.id);

    const existing = await getSubdistrictById(subdistrictId);

    if (!existing) {
      return error(res, 'Subdistrict not found', 404);
    }

    const subdistrict = await repoUpdate(
      subdistrictId,
      req.body
    );

    return success(
      res,
      subdistrict,
      'Subdistrict updated'
    );
  } catch (err) {
    return error(res, err.message, 500);
  }
};

/* DELETE /api/subdistricts/:id */
const deleteSubdistrict = async (req, res) => {
  try {
    if (!canDeleteSubdistricts(req.user.role)) {
      return error(
        res,
        'You do not have permission to delete subdistricts',
        403
      );
    }

    const subdistrictId = Number(req.params.id);

    const existing = await getSubdistrictById(subdistrictId);

    if (!existing) {
      return error(res, 'Subdistrict not found', 404);
    }

    await repoDelete(subdistrictId);

    return success(
      res,
      null,
      'Subdistrict deleted'
    );
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = {
  getSubdistricts,
  getSubdistrict,
  createSubdistrict,
  updateSubdistrict,
  deleteSubdistrict,
};