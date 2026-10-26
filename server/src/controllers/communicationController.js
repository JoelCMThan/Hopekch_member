/**
 * server/src/controllers/communicationController.js
 */

const communicationService = require('../services/communicationService');

/* ── getCommunicationOverview ─────────────────────────────── */

const getCommunicationOverview = async (req, res) => {
  try {
    const overview =
      await communicationService.getCommunicationOverview();

    return res.status(200).json(overview);
  } catch (err) {
    console.error('getCommunicationOverview error:', err);

    return res.status(err.status || 500).json({
      message:
        err.message ||
        'Failed to get communication overview',
    });
  }
};


/* ── searchRecipients ─────────────────────────────────────── */

const searchRecipients = async (req, res) => {
  try {
    const {
      search,
      subdistrictId = null,
      unitId = null,
      lifeGroupId = null,
    } = req.query;

    const recipients =
      await communicationService.searchRecipients({
        search,
        subdistrictId,
        unitId,
        lifeGroupId,
      });

    return res.status(200).json({
      recipients,
    });
  } catch (err) {
    console.error('searchRecipients error:', err);

    return res.status(err.status || 500).json({
      message:
        err.message ||
        'Failed to search recipients',
    });
  }
};


/* ── getRecipientCount ────────────────────────────────────── */

const getRecipientCount = async (req, res) => {
  try {
    const {
      recipientType = 'all',
      memberIds = [],
      subdistrictId = null,
      unitId = null,
      lifeGroupId = null,
      leadershipLevel = null,
      leadershipLevels = [],
      includeHigherLeadership = false,
    } = req.body;

    const count =
      await communicationService.getRecipientCount({
        recipientType,
        memberIds,
        subdistrictId,
        unitId,
        lifeGroupId,
        leadershipLevel,
        leadershipLevels,
        includeHigherLeadership,
      });

    return res.status(200).json({
      count,
    });
  } catch (err) {
    console.error('getRecipientCount error:', err);

    return res.status(err.status || 500).json({
      message:
        err.message ||
        'Failed to get recipient count',
    });
  }
};


/* ── getRecipientOptions ──────────────────────────────────── */

const getRecipientOptions = async (req, res) => {
  try {
    const options =
      await communicationService.getRecipientOptions();

    return res.status(200).json(options);
  } catch (err) {
    console.error('getRecipientOptions error:', err);

    return res.status(err.status || 500).json({
      message:
        err.message ||
        'Failed to get recipient options',
    });
  }
};


/* ── createDraft ──────────────────────────────────────────── */

const createDraft = async (req, res) => {
  try {
    const {
      subject,
      message,
      recipientType = 'all',
      memberIds = [],
      subdistrictId = null,
      unitId = null,
      lifeGroupId = null,
      leadershipLevel = null,
      leadershipLevels = [],
      includeHigherLeadership = false,
    } = req.body;

    const senderUserId =
      req.user?.userId ??
      req.user?.UserID ??
      null;

    const draft =
      await communicationService.createDraft({
        senderUserId,
        subject,
        message,
        recipientType,
        memberIds,
        subdistrictId,
        unitId,
        lifeGroupId,
        leadershipLevel,
        leadershipLevels,
        includeHigherLeadership,
      });

    return res.status(201).json({
      success: true,
      draft,
    });
  } catch (err) {
    console.error('createDraft error:', err);

    return res.status(err.status || 500).json({
      message:
        err.message ||
        'Failed to create email draft',
    });
  }
};


/* ── updateDraft ──────────────────────────────────────────── */

const updateDraft = async (req, res) => {
  try {
    const { emailId } = req.params;

    const parsedEmailId = Number(emailId);

    if (
      !Number.isInteger(parsedEmailId) ||
      parsedEmailId <= 0
    ) {
      return res.status(400).json({
        message: 'Invalid email ID',
      });
    }

    const {
      subject,
      message,
      recipientType = null,
      memberIds = [],
      subdistrictId = null,
      unitId = null,
      lifeGroupId = null,
      leadershipLevel = null,
      leadershipLevels = [],
      includeHigherLeadership = false,
    } = req.body;

    const senderUserId =
      req.user?.userId ??
      req.user?.UserID ??
      null;

    const draft =
      await communicationService.updateDraft(
        parsedEmailId,
        {
          senderUserId,
          subject,
          message,
          recipientType,
          memberIds,
          subdistrictId,
          unitId,
          lifeGroupId,
          leadershipLevel,
          leadershipLevels,
          includeHigherLeadership,
        }
      );

    return res.status(200).json({
      success: true,
      draft,
    });
  } catch (err) {
    console.error('updateDraft error:', err);

    return res.status(err.status || 500).json({
      message:
        err.message ||
        'Failed to update email draft',
    });
  }
};


/* ── getDrafts ────────────────────────────────────────────── */

const getDrafts = async (req, res) => {
  try {
    const {
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const drafts =
      await communicationService.getDrafts({
        search,
        page: Number(page),
        limit: Number(limit),
      });

    return res.status(200).json(drafts);
  } catch (err) {
    console.error('getDrafts error:', err);

    return res.status(err.status || 500).json({
      message:
        err.message ||
        'Failed to get email drafts',
    });
  }
};


/* ── discardDraft ─────────────────────────────────────────── */

const discardDraft = async (req, res) => {
  try {
    const { emailId } = req.params;

    const parsedEmailId = Number(emailId);

    if (
      !Number.isInteger(parsedEmailId) ||
      parsedEmailId <= 0
    ) {
      return res.status(400).json({
        message: 'Invalid email ID',
      });
    }

    const senderUserId =
      req.user?.userId ??
      req.user?.UserID ??
      null;

    const result =
      await communicationService.discardDraft(
        parsedEmailId,
        senderUserId
      );

    return res.status(200).json({
      success: true,
      message: 'Email draft discarded successfully',
      result,
    });
  } catch (err) {
    console.error('discardDraft error:', err);

    return res.status(err.status || 500).json({
      message:
        err.message ||
        'Failed to discard email draft',
    });
  }
};


/* ── sendEmail ────────────────────────────────────────────── */

const sendEmail = async (req, res) => {
  try {
    const {
      emailId = null,
      subject,
      message,
      recipientType = 'all',
      memberIds = [],
      subdistrictId = null,
      unitId = null,
      lifeGroupId = null,
      leadershipLevel = null,
      leadershipLevels = [],
      includeHigherLeadership = false,
      attachments = [],
    } = req.body;

    let parsedEmailId = null;

    if (emailId !== null && emailId !== undefined) {
      parsedEmailId = Number(emailId);

      if (
        !Number.isInteger(parsedEmailId) ||
        parsedEmailId <= 0
      ) {
        return res.status(400).json({
          message: 'Invalid email ID',
        });
      }
    }

    const senderUserId =
      req.user?.userId ??
      req.user?.UserID ??
      null;

    const result =
      await communicationService.sendEmail({
        emailId: parsedEmailId,
        senderUserId,
        subject,
        message,
        recipientType,
        memberIds,
        subdistrictId,
        unitId,
        lifeGroupId,
        leadershipLevel,
        leadershipLevels,
        includeHigherLeadership,
        attachments,
      });

    return res.status(200).json(result);
  } catch (err) {
    console.error('sendEmail error:', err);

    return res.status(err.status || 500).json({
      message:
        err.message ||
        'Failed to send email',
    });
  }
};


/* ── getEmailHistory ──────────────────────────────────────── */

const getEmailHistory = async (req, res) => {
  try {
    const {
      search,
      status = null,
      page = 1,
      limit = 10,
    } = req.query;

    const history =
      await communicationService.getEmailHistory({
        search,
        status,
        page: Number(page),
        limit: Number(limit),
      });

    return res.status(200).json(history);
  } catch (err) {
    console.error('getEmailHistory error:', err);

    return res.status(err.status || 500).json({
      message:
        err.message ||
        'Failed to get email history',
    });
  }
};


/* ── getEmailHistoryById ──────────────────────────────────── */

const getEmailHistoryById = async (req, res) => {
  try {
    const { emailId } = req.params;

    const parsedEmailId = Number(emailId);

    if (
      !Number.isInteger(parsedEmailId) ||
      parsedEmailId <= 0
    ) {
      return res.status(400).json({
        message: 'Invalid email ID',
      });
    }

    const email =
      await communicationService.getEmailHistoryById(
        parsedEmailId
      );

    return res.status(200).json(email);
  } catch (err) {
    console.error('getEmailHistoryById error:', err);

    return res.status(err.status || 500).json({
      message:
        err.message ||
        'Failed to get email record',
    });
  }
};


/* ── exports ──────────────────────────────────────────────── */

module.exports = {
  getCommunicationOverview,
  searchRecipients,
  getRecipientCount,
  getRecipientOptions,

  createDraft,
  updateDraft,
  getDrafts,
  discardDraft,

  sendEmail,

  getEmailHistory,
  getEmailHistoryById,
};