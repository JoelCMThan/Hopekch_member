const { getMemberUserRole } = require('../repositories/memberRepo');
const { canManageMember, canDeactivateMembers } = require('../utils/permissions');
const inactiveMemberRepo = require('../repositories/inactiveMemberRepo');

/**
 * GET /api/inactive-members
 * Get inactive members under user's scope
 */
const getInactiveMembers = async (req, res, next) => {
  try {
    const { search, page, limit, reason } = req.query;

    const result = await inactiveMemberRepo.getInactiveMembers(
      req.user,
      {
        search,
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        reason,
      }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/inactive-members/search
 * Search active members for deactivate modal
 */
const searchMembersForDeactivate = async (req, res, next) => {
  try {
    const { q, keyword } = req.query;

    const searchTerm = (q ?? keyword ?? '').toString().trim();

    if (!searchTerm) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const members = await inactiveMemberRepo.searchMembersForDeactivate(
      req.user,
      searchTerm
    );

    res.json({
      success: true,
      data: members,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/inactive-members/:id/deactivate
 */
const deactivateMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Inactive reason is required',
      });
    }

    if (!canManageMember(req.user.role, await getMemberUserRole(Number(id)))) {
      return res.status(403).json({ success: false, message: 'Only master admins can manage master admin accounts' });
    }

    await inactiveMemberRepo.deactivateMember(
      Number(id),
      reason,
      notes || null
    );

    res.json({
      success: true,
      message: 'Member has been marked inactive',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/inactive-members/:id/activate
 */
const activateMember = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!canManageMember(req.user.role, await getMemberUserRole(Number(id)))) {
      return res.status(403).json({ success: false, message: 'Only master admins can manage master admin accounts' });
    }

    await inactiveMemberRepo.activateMember(
      Number(id)
    );

    res.json({
      success: true,
      message: 'Member has been restored',
    });
  } catch (err) {
    next(err);
  }
};

const updateInactiveDetails = async (req, res, next) => {
  try {
    const memberId = Number(req.params.id);
    const { reason, notes } = req.body;
    const reasons = ['Transferred University', 'Moved', 'Changed Church', 'Migrant', 'Personal', 'Others'];
    if (!Number.isSafeInteger(memberId) || memberId <= 0 || !reasons.includes(reason) ||
        (notes != null && typeof notes !== 'string')) {
      return res.status(400).json({ success: false, message: 'Provide a valid member, inactive reason and notes' });
    }
    if (!canDeactivateMembers(req.user.role) ||
        !await inactiveMemberRepo.isMemberWithinScope(req.user, memberId) ||
        !canManageMember(req.user.role, await getMemberUserRole(memberId))) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this member' });
    }
    const result = await inactiveMemberRepo.updateInactiveDetails(memberId, reason, notes?.trim() || null);
    if (!result.success) {
      return res.status(404).json({ success: false, message: 'Inactive member not found. Refresh the list and try again.' });
    }
    return res.json({ success: true, message: 'Inactive member details updated' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  updateInactiveDetails,
  getInactiveMembers,
  searchMembersForDeactivate,
  deactivateMember,
  activateMember,
};