const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { MEMBERS_MODULE_ROLES } = require('../utils/permissions');
const {
  updateInactiveDetails,
  getInactiveMembers,
  searchMembersForDeactivate,
  deactivateMember,
  activateMember,
} = require('../controllers/inactiveMemberController');

router.use(authenticate);
router.use(requireRole(MEMBERS_MODULE_ROLES));

router.get('/', getInactiveMembers);
router.get('/search', searchMembersForDeactivate);
router.patch('/:id', updateInactiveDetails);
router.post('/:id/deactivate', deactivateMember);
router.post('/:id/activate', activateMember);

module.exports = router;
