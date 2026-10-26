const { checkScope, changeStatus } = require('../controllers/organizationController');
/**
 * server/src/routes/group.routes.js
 * Mounted at: /api/groups
 */
const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { GROUPS_MODULE_ROLES } = require('../utils/permissions');
const {
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  splitGroup,
  getUnits,
  getSubdistricts,
} = require('../controllers/groupController');

// Every /api/groups route requires: valid JWT + one of the groups-module roles
router.use(authenticate);
router.use(requireRole(GROUPS_MODULE_ROLES));

// Lookup helpers (before /:id to avoid route collision)
router.get('/lookup/units', getUnits);
router.get('/lookup/subdistricts', getSubdistricts);

// CRUD
router.get('/', getGroups);
router.get('/:id', checkScope('group'), getGroup);
router.post('/', createGroup);
router.put('/:id', checkScope('group'), updateGroup);
router.delete('/:id', checkScope('group'), deleteGroup);

// Split endpoint
router.post('/:id/split', checkScope('group'), splitGroup);

router.patch('/:id/activate', changeStatus('group', true));
router.patch('/:id/inactivate', changeStatus('group', false));

module.exports = router;
