const express = require('express');
const authenticate = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { ROLES } = require('../utils/permissions');
const { getLlmSettings, updateLlmSettings, updateLlmApiKey } = require('../controllers/settingsController');

const router = express.Router();
const SETTINGS_ROLES = [ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER];

router.use(authenticate, requireRole(SETTINGS_ROLES));
router.get('/llm', getLlmSettings);
router.patch('/llm', updateLlmSettings);
router.patch('/llm/key', updateLlmApiKey);

module.exports = router;
