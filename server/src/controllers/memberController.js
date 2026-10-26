const {
  getMembers:          repoGetMembers,
  getMemberById,
  createMember:        repoCreate,
  updateMember:        repoUpdate,
  deleteMember:        repoDelete,
  isMemberInScope,
  setMemberPassword,
  getMemberUserRole,
  getLifeGroups:       repoGetLifeGroups,
  getUnits:            repoGetUnits,
  getSubdistricts:     repoGetSubdistricts,
} = require('../repositories/memberRepo');

const { success, error } = require('../utils/apiResponse');
const {
  canManageMember,
  canCreateMembers,
  canEditMembers,
  canDeleteMembers,
  canSelfEdit,
  canAssignRole,
  canDeactivateMembers,
  ROLES,
} = require('../utils/permissions');

const { hashPassword } = require('../utils/passwordHash');
const bulkImportService = require('../services/memberBulkImportService');
const { canBulkImportMembers, canManageBulkImport } = require('../utils/permissions');

const requireBulkImporter = (req, res) => {
  if (canBulkImportMembers(req.user.role)) return true;
  error(res, 'Only managers and administrators can import members', 403);
  return false;
};

const requireBulkImportManager = (req, res) => {
  if (canManageBulkImport(req.user.role)) return true;
  error(res, 'Only managers and administrators can manage bulk imports', 403);
  return false;
};

const bulkImportMembers = async (req, res) => {
  try {
    if (!requireBulkImporter(req, res)) return;
    const imported = await bulkImportService.bulkImport(req.body.members, req.user);
    return success(res, { imported, count: imported.length }, `${imported.length} members imported`, 201);
  } catch (err) {
    if (err.details) {
      return res.status(err.statusCode || 400).json({ success: false, message: err.message, errors: err.details });
    }
    return error(res, err.message, err.statusCode || 500);
  }
};

const getBulkImportPasswordStatus = async (req, res) => {
  try {
    if (!requireBulkImportManager(req, res)) return;
    return success(res, await bulkImportService.getPasswordStatus(), 'Default password status retrieved');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const updateBulkImportPassword = async (req, res) => {
  try {
    if (!requireBulkImportManager(req, res)) return;
    const status = await bulkImportService.changeDefaultPassword(req.body.password, req.user.userId);
    return success(res, status, 'Bulk import default password updated');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

/* GET /api/members */
const getMembers = async (req, res) => {
  try {
    const {
      search,
      membershipType,
      membershipStatus,
      role,
      gender,
      subdistrictId,
      unitId,
      lifeGroupId,
      page,
      limit,
    } = req.query;

    const result = await repoGetMembers({
      user: req.user,
      exportAll: req.query.export === 'true',
      search:         search || undefined,
      membershipType: membershipType || undefined,
      membershipStatus: ['active', 'inactive'].includes(membershipStatus) ? membershipStatus : undefined,
      role:           role || undefined,
      gender:         gender || undefined,
      subdistrictId:  subdistrictId || undefined,
      unitId:         unitId || undefined,
      lifeGroupId:    lifeGroupId || undefined,
      page:  page  ? Number(page)  : 1,
      limit: limit ? Number(limit) : 20,
    });

    return success(res, result, 'Members retrieved');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* GET /api/members/:id */
const getMember = async (req, res) => {
  try {
    const memberId = Number(req.params.id);

    const member = await getMemberById(memberId);

    if (!member) {
      return error(res, 'Member not found', 404);
    }

    const inScope = await isMemberInScope(memberId, req.user);

    if (!inScope) {
      return error(res, 'This member is not within your scope', 403);
    }

    return success(res, member, 'Member retrieved');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* POST /api/members */
const createMember = async (req, res) => {
  try {
    if (!canCreateMembers(req.user.role)) {
      return error(res, 'You do not have permission to create members', 403);
    }

    const { password, role = 'member' } = req.body;

    // Validate password if provided
    if (password) {
      if (typeof password !== 'string' || password.length < 6) {
        return error(res, 'Password must be at least 6 characters', 400);
      }
    }

    // Validate role assignment
    const roleValidation = canAssignRole(req.user.role, role);
    if (!roleValidation.allowed) {
      return error(res, roleValidation.reason || 'Cannot assign this role', 403);
    }

    // Prepare member data
    const memberData = { ...req.body, role };

    // Hash and add password if provided
    if (password) {
      memberData.passwordHash = await hashPassword(password);
    }

    const member = await repoCreate(memberData);

    return success(res, member, 'Member created', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* PUT /api/members/:id */
const updateMember = async (req, res) => {
  try {
    const targetId = Number(req.params.id);

    const existing = await getMemberById(targetId);

    if (!existing) {
      return error(res, 'Member not found', 404);
    }

    if (!canManageMember(req.user.role, existing.Role)) {
      return error(res, 'Only master admins can manage master admin accounts', 403);
    }

    const isSelf = req.user && Number(req.user.memberId) === targetId;

    if (!canEditMembers(req.user.role) && !canSelfEdit(req.user.role, isSelf)) {
      return error(res, 'You do not have permission to edit members', 403);
    }

    const inScope = await isMemberInScope(targetId, req.user);

    if (!inScope) {
      return error(res, 'This member is not within your scope', 403);
    }

    // Handle role assignment if provided
    const { role } = req.body;
    if (role !== null && role !== undefined) {
      // Only leaders/admin can assign roles to others (not self-edit)
      if (!canEditMembers(req.user.role)) {
        return error(res, 'You do not have permission to assign roles', 403);
      }

      const roleValidation = canAssignRole(req.user.role, role);
      if (!roleValidation.allowed) {
        return error(res, roleValidation.reason || 'Cannot assign this role', 403);
      }
    }

    const memberData = { ...req.body };
    const statusFields = ['membershipIsActive', 'inactiveReason', 'inactiveNotes'];
    if (statusFields.some(field => Object.hasOwn(memberData, field))) {
      if (!canDeactivateMembers(req.user.role)) {
        return error(res, 'You do not have permission to change membership status', 403);
      }
      const reasons = ['Transferred University', 'Moved', 'Changed Church', 'Migrant', 'Personal', 'Others'];
      if (typeof memberData.membershipIsActive !== 'boolean' ||
          (!memberData.membershipIsActive && !reasons.includes(memberData.inactiveReason)) ||
          (memberData.inactiveNotes != null && typeof memberData.inactiveNotes !== 'string')) {
        return error(res, 'Provide a valid membership status, inactive reason and notes', 400);
      }
      memberData.deactivatedByMemberId = req.user.memberId;
    }

    const member = await repoUpdate(targetId, memberData);

    return success(res, member, 'Member updated');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* DELETE /api/members/:id */
const deleteMember = async (req, res) => {
  try {
    if (!canDeleteMembers(req.user.role)) {
      return error(res, 'Only admins can delete members', 403);
    }

    const targetId = Number(req.params.id);

    const existing = await getMemberById(targetId);

    if (!existing) {
      return error(res, 'Member not found', 404);
    }

    if (!canManageMember(req.user.role, existing.Role)) {
      return error(res, 'Only master admins can manage master admin accounts', 403);
    }

    await repoDelete(targetId);

    return success(res, null, 'Member deleted');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* PATCH /api/members/:id/password */
const resetMemberPassword = async (req, res) => {
  try {
    const targetId   = Number(req.params.id);
    const { password } = req.body;

    if (!password || String(password).length < 6) {
      return error(res, 'Password must be at least 6 characters', 400);
    }

    const existing = await getMemberById(targetId);
    if (!existing) return error(res, 'Member not found', 404);

    const isSelf       = Number(req.user.memberId) === targetId;
    const targetRole   = await getMemberUserRole(targetId);
    const actorRole    = req.user.role;

    // Self-password change always allowed (any authenticated member)
    if (!canManageMember(actorRole, targetRole)) {
      return error(res, 'Only master admins can manage master admin accounts', 403);
    }

    if (!isSelf) {
      // Leaders/admin resetting someone else's password
      if (!canEditMembers(actorRole)) {
        return error(res, 'You do not have permission to reset passwords', 403);
      }
      // Scope check — leader can only reset members within their scope
      const inScope = await isMemberInScope(targetId, req.user);
      if (!inScope) {
        return error(res, 'This member is not within your scope', 403);
      }
    }

    const passwordHash = await hashPassword(password);
    // Use target member's existing role or default to 'member' for new accounts
    await setMemberPassword(targetId, passwordHash, targetRole ?? 'member');

    return success(res, null, 'Password updated successfully');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* GET /api/members/life-groups */
const getLifeGroups = async (req, res) => {
  try {
    const groups = await repoGetLifeGroups(
      req.query.unitId ? Number(req.query.unitId) : null,
      req.query.subdistrictId ? Number(req.query.subdistrictId) : null,
      req.query.usableOnly === 'true'
    );

    return success(res, groups, 'Life groups retrieved');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* GET /api/members/units */
const getUnits = async (req, res) => {
  try {
    const units = await repoGetUnits(req.query.usableOnly === 'true');

    return success(res, units, 'Units retrieved');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

/* GET /api/members/subdistricts */
const getSubdistricts = async (req, res) => {
  try {
    const subdistricts = await repoGetSubdistricts(req.query.usableOnly === 'true');

    return success(res, subdistricts, 'Subdistricts retrieved');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
};

module.exports = {
  getMembers,
  getMember,
  createMember,
  updateMember,
  deleteMember,
  resetMemberPassword,
  getLifeGroups,
  getUnits,
  getSubdistricts,
  bulkImportMembers,
  getBulkImportPasswordStatus,
  updateBulkImportPassword,
};
