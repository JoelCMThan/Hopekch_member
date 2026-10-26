/* Mounted at: /api/dashboard */

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const { getDashboard } = require('../controllers/dashboardController');

// All dashboard routes require a valid JWT
router.use(authenticate);

router.get('/', getDashboard);

module.exports = router;