/**
 * server/src/routes/member.routes.js
 * Mounted at: /api/members
 */
const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { MEMBERS_MODULE_ROLES } = require('../utils/permissions');
const {
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
} = require('../controllers/memberController');

// Every /api/members route requires: valid JWT + one of the members-module roles
router.use(authenticate);

// Register static bulk-import paths before the dynamic /:id/password route.
// The controller additionally restricts these operations to manager and above.
router.post('/bulk-import', bulkImportMembers);
router.get('/bulk-import/password', getBulkImportPasswordStatus);
router.patch('/bulk-import/password', updateBulkImportPassword);

// Password changes are allowed for self, even when the member cannot access
// the full members module. Non-self resets are checked inside the controller.
router.patch('/:id/password', resetMemberPassword);

router.use(requireRole(MEMBERS_MODULE_ROLES));

// Lookup helpers (before /:id to avoid route collision)
router.get('/life-groups', getLifeGroups);
router.get('/units', getUnits);
router.get('/subdistricts', getSubdistricts);

// CRUD
router.get('/', getMembers);
router.get('/:id', getMember);
router.post('/', createMember);
router.put('/:id', updateMember);
router.delete('/:id', deleteMember);

module.exports = router;
