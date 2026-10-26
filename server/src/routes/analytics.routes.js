/* server/src/routes/analytics.routes.js */

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { ANALYTICS_MODULE_ROLES, ROLES } = require('../utils/permissions');

const {
  getAnalytics,
  getAnalyticsFilters,
  recordSundayAttendance,
} = require('../controllers/analyticsController');

router.use(authenticate);
router.use(requireRole(ANALYTICS_MODULE_ROLES));

router.get('/filters', getAnalyticsFilters);
router.post('/attendance', requireRole([ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]), recordSundayAttendance);
router.get('/', getAnalytics);

module.exports = router;
