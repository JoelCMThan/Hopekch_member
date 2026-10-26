/**
 * server/src/routes/communication.routes.js
 */

const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { COMMUNICATION_MODULE_ROLES } = require('../utils/permissions');

const {
  getCommunicationOverview,
  getRecipientOptions,
  searchRecipients,
  getRecipientCount,
  createDraft,
  getDrafts,
  updateDraft,
  discardDraft,
  sendEmail,
  getEmailHistory,
  getEmailHistoryById,
} = require('../controllers/communicationController');

/* All communication routes require authentication and authorization */
router.use(authenticate);
router.use(requireRole(COMMUNICATION_MODULE_ROLES));

/* Communication overview and recipient management */
router.get('/overview', getCommunicationOverview);
router.get('/recipients/options', getRecipientOptions);
router.get('/recipients/search', searchRecipients);
router.post('/recipients/count', getRecipientCount);

/* Draft management */
router.post('/drafts', createDraft);
router.get('/drafts', getDrafts);
router.put('/drafts/:emailId', updateDraft);
router.delete('/drafts/:emailId', discardDraft);

/* Sending emails and history */
router.post('/send', sendEmail);
router.get('/history', getEmailHistory);
router.get('/history/:emailId', getEmailHistoryById);

module.exports = router;