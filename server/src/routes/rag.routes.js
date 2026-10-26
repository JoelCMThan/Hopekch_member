const express = require('express');

const authenticate =
  require('../middleware/authenticate');

const { requireRole } =
  require('../middleware/requireRole');

const { RAG_MODULE_ROLES } = require('../utils/permissions');

const { askQuestion } =
  require('../controllers/ragController');

const router = express.Router();

router.use(authenticate);

// Initial restricted access.
// Extend only after implementing role-scoped retrieval.
router.use(requireRole(RAG_MODULE_ROLES));

router.post('/ask', askQuestion);

module.exports = router;
