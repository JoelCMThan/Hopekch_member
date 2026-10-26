const { checkScope, changeStatus } = require('../controllers/organizationController');
/**
 * server/src/routes/subdistrictRoutes.js
 */

const express = require('express');
const router = express.Router();
const { splitHandler } = require('../controllers/hierarchySplitController');

const {
  getSubdistricts,
  getSubdistrict,
  createSubdistrict,
  updateSubdistrict,
  deleteSubdistrict,
} = require('../controllers/subdistrictController');

const authenticate = require('../middleware/authenticate');

const { requireRole } = require('../middleware/requireRole');
const { SUBDISTRICTS_MODULE_ROLES } = require('../utils/permissions');

/* All subdistrict routes require authentication and authorization */
router.use(authenticate);
router.use(requireRole(SUBDISTRICTS_MODULE_ROLES));

/* GET /api/subdistricts */
router.get('/', getSubdistricts);

/* CRUD */
router.post('/', createSubdistrict);
router.get('/:id/split-options', checkScope('subdistrict'), splitHandler('subdistrict', true));
router.post('/:id/split', checkScope('subdistrict'), splitHandler('subdistrict'));
router.get('/:id', checkScope('subdistrict'), getSubdistrict);
router.put('/:id', checkScope('subdistrict'), updateSubdistrict);
router.delete('/:id', checkScope('subdistrict'), deleteSubdistrict);

router.patch('/:id/activate', changeStatus('subdistrict', true));
router.patch('/:id/inactivate', changeStatus('subdistrict', false));

module.exports = router;
