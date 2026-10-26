/**
 * server/src/services/communicationService.js
 */

const axios = require('axios');
const sanitizeHtml = require('sanitize-html');

const communicationRepo = require('../repositories/communicationRepo');

const hasIds = (value) =>
  Array.isArray(value) ? value.length > 0 : Boolean(value);

const displayIds = (value) =>
  Array.isArray(value) ? value.join(', ') : value;

/* ── Leadership Levels ── */
const LEADERSHIP_LEVELS = [
  'admin',
  'manager',
  'subdistrict_leader',
  'unit_leader',
  'assistantunit_leader',
  'lg_leader',
  'assistantlg_leader',
];

const getLeadershipRoles = (
  leadershipLevel,
  includeHigherLeadership = false,
  leadershipLevels = []
) => {
  if (Array.isArray(leadershipLevels) && leadershipLevels.length > 0) {
    return [...new Set(
      leadershipLevels.filter((level) => LEADERSHIP_LEVELS.includes(level))
    )];
  }

  if (leadershipLevel === 'all') {
    return [...LEADERSHIP_LEVELS];
  }

  const levelIndex = LEADERSHIP_LEVELS.indexOf(leadershipLevel);

  if (levelIndex === -1) return [];

  if (!includeHigherLeadership) {
    return [leadershipLevel];
  }

  return LEADERSHIP_LEVELS.slice(0, levelIndex + 1);
};

/* ── Mailjet Configuration ────────────────────────────────── */

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const MAILJET_SEND_URL = 'https://api.mailjet.com/v3.1/send';
const MAILJET_FROM_EMAIL = process.env.MAILJET_FROM_EMAIL;
const MAILJET_FROM_NAME = process.env.MAILJET_FROM_NAME;

// For email content formatting
const markdownToHtml = (message) => {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(
      /(<li>.*<\/li>)(?:<br>|\n)?(?=<li>)/g,
      '$1'
    )
    .replace(
      /(<li>.*<\/li>)(?=<br>|$)/g,
      '<ul>$1</ul>'
    )
    .replace(
      /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
      '<img src="$2" alt="$1" style="max-width:100%;height:auto;">'
    )
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2">$1</a>'
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
};

  const sanitizeEditorHtml = (message) =>
    sanitizeHtml(message, {
      allowedTags: [
        'p',
        'div',
        'strong',
        'em',
        'ul',
        'ol',
        'li',
        'a',
        'img',
        'br',
      ],

      allowedAttributes: {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt'],
      },

      allowedSchemes: ['http', 'https'],

      allowedSchemesByTag: {
        a: ['http', 'https'],
        img: ['http', 'https'],
      },

      allowProtocolRelative: false,

      transformTags: {
        a: (tagName, attribs) => ({
          tagName: 'a',
          attribs: {
            href: attribs.href || '',
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        }),
      },
    });

  const htmlToPlainText = (message) =>
    message
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

  const prepareStoredMessage = (message) => {
    const trimmed = message.trim();

    const containsEditorHtml =
      /<\/?(?:p|div|strong|em|ul|ol|li|a|img|br)\b/i.test(trimmed);

    return containsEditorHtml
      ? sanitizeEditorHtml(trimmed)
      : trimmed;
  };


/* ── validateEmail ────────────────────────────────────────── */

const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email.trim()
  );
};

/* ── Recipients ───────────────────────────────────────────── */

const getRecipients = async ({
  recipientType = 'all',
  memberIds = [],
  subdistrictId = null,
  unitId = null,
  lifeGroupId = null,
  leadershipLevel = null,
  leadershipLevels = [],
  includeHigherLeadership = false,
} = {}) => {
  if (recipientType === 'all') {
    return communicationRepo.getActiveMembers();
  }

  if (recipientType === 'group') {
    return communicationRepo.getMembersByGroup(lifeGroupId);
  }

  if (recipientType === 'unit') {
    return communicationRepo.getMembersByUnit(unitId);
  }

  if (recipientType === 'subdistrict') {
    return communicationRepo.getMembersBySubdistrict(
      subdistrictId
    );
  }

  if (recipientType === 'members') {
    return communicationRepo.getMembersByIds(memberIds);
  }

  if (recipientType === 'leadership') {
    const roles = getLeadershipRoles(
      leadershipLevel,
      includeHigherLeadership,
      leadershipLevels
    );

    if (roles.length === 0) {
      const error = new Error('Invalid leadership level');
      error.status = 400;
      throw error;
    }

    return communicationRepo.getMembersByRoles(roles);
  }

  if (recipientType === 'filter') {
    return communicationRepo.getActiveMembers({
      subdistrictId,
      unitId,
      lifeGroupId,
    });
  }

  throw new Error('Invalid recipient type');
};

/* ── Search Recipients ────────────────────────────────────── */

const searchRecipients = async ({
  search,
  subdistrictId = null,
  unitId = null,
  lifeGroupId = null,
} = {}) => {
  if (!search || !search.trim()) return [];

  return communicationRepo.getActiveMembers({
    search: search.trim(),
    subdistrictId,
    unitId,
    lifeGroupId,
  });
};

/* ── Recipient Count ──────────────────────────────────────── */

const getRecipientCount = async ({
  recipientType = 'all',
  memberIds = [],
  subdistrictId = null,
  unitId = null,
  lifeGroupId = null,
  leadershipLevel = null,
  leadershipLevels = [],
  includeHigherLeadership = false,
} = {}) => {
  if (recipientType === 'all') {
    return communicationRepo.getActiveMemberCount();
  }

  if (recipientType === 'group') {
    if (!hasIds(lifeGroupId)) return 0;

    return communicationRepo.getActiveMemberCount({
      lifeGroupId,
    });
  }

  if (recipientType === 'unit') {
    if (!hasIds(unitId)) return 0;

    return communicationRepo.getActiveMemberCount({
      unitId,
    });
  }

  if (recipientType === 'subdistrict') {
    if (!hasIds(subdistrictId)) return 0;

    return communicationRepo.getActiveMemberCount({
      subdistrictId,
    });
  }

  if (recipientType === 'members') {
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return 0;
    }

    const members =
      await communicationRepo.getMembersByIds(memberIds);

    return members.length;
  }

  if (recipientType === 'leadership') {
    const roles = getLeadershipRoles(
      leadershipLevel,
      includeHigherLeadership,
      leadershipLevels
    );

    if (roles.length === 0) return 0;

    const members =
      await communicationRepo.getMembersByRoles(roles);

    return members.length;
  }

  if (recipientType === 'filter') {
    return communicationRepo.getActiveMemberCount({
      subdistrictId,
      unitId,
      lifeGroupId,
    });
  }

  throw new Error('Invalid recipient type');
};

/* ── Recipient Scope ──────────────────────────────────────── */

const buildRecipientScope = async ({
  preserveMemberIds = false,
  recipientType = 'all',
  subdistrictId = null,
  unitId = null,
  lifeGroupId = null,
  memberIds = [],
  leadershipLevel = null,
  leadershipLevels = [],
  includeHigherLeadership = false,
} = {}) => {
  if (recipientType === 'all') {
    return 'All Members';
  }

  if (recipientType === 'group') {
    return lifeGroupId
      ? `Life Group ${displayIds(lifeGroupId)}`
      : 'Life Group';
  }

  if (recipientType === 'unit') {
    return unitId
      ? `Unit ${displayIds(unitId)}`
      : 'Unit';
  }

  if (recipientType === 'subdistrict') {
    return subdistrictId
      ? `Subdistrict ${displayIds(subdistrictId)}`
      : 'Subdistrict';
  }

  if (recipientType === 'members') {
    if (preserveMemberIds) {
      const ids = [...new Set((Array.isArray(memberIds) ? memberIds : [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0))];
      return `Selected Members [${ids.join(', ')}]`;
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return 'Selected Members';
    }

    const members =
      await communicationRepo.getMembersByIds(memberIds);

    if (!members.length) {
      return 'Selected Members';
    }

    return members
      .map((member) => {
        const name = [
          member.FirstName,
          member.LastName,
        ]
          .filter(Boolean)
          .join(' ')
          .trim();

        const email = member.Email?.trim();

        if (name && email) {
          return `${name} (${email})`;
        }

        return name || email || 'Unknown Member';
      })
      .join(', ');
  }

  if (recipientType === 'leadership') {
    const labels = {
      all: 'All Leaders',
      subdistrict_leader: 'Subdistrict Leader',
      unit_leader: 'Unit Leader',
      assistantunit_leader: 'Assistant Unit Leader',
      lg_leader: 'Life Group Leader',
      assistantlg_leader: 'Assistant Life Group Leader',
    };

    if (Array.isArray(leadershipLevels) && leadershipLevels.length > 0) {
      const groupedLabels = {
        admin: 'Admin',
        manager: 'Manager',
        subdistrict_leader: 'Subdistrict Leader',
        unit_leader: 'Unit / Assistant Unit Leaders',
        assistantunit_leader: 'Unit / Assistant Unit Leaders',
        lg_leader: 'LG / Assistant LG Leaders',
        assistantlg_leader: 'LG / Assistant LG Leaders',
      };
      const selectedLabels = [...new Set(
        leadershipLevels.map((level) => groupedLabels[level]).filter(Boolean)
      )];
      return `Leadership: ${selectedLabels.join(', ')}`;
    }

    const label = labels[leadershipLevel] ?? 'Leadership';

    if (
      includeHigherLeadership &&
      leadershipLevel !== 'all' &&
      leadershipLevel !== 'subdistrict_leader'
    ) {
      return `${label} and Above`;
    }

    return label;
  }

  if (recipientType === 'filter') {
    const parts = [];

    if (hasIds(subdistrictId)) {
      parts.push(
        `Subdistrict ${displayIds(subdistrictId)}`
      );
    }

    if (hasIds(unitId)) {
      parts.push(`Unit ${displayIds(unitId)}`);
    }

    if (hasIds(lifeGroupId)) {
      parts.push(
        `Life Group ${displayIds(lifeGroupId)}`
      );
    }

    return parts.length > 0
      ? parts.join(' / ')
      : 'Filtered Members';
  }

  return 'Unknown';
};

/* ── Validate Sender ──────────────────────────────────────── */

const validateSender = (senderUserId) => {
  if (
    senderUserId === null ||
    senderUserId === undefined
  ) {
    const error = new Error(
      'Authenticated user is required'
    );

    error.status = 401;
    throw error;
  }

  const userId = Number(senderUserId);

  if (!Number.isInteger(userId) || userId <= 0) {
    const error = new Error(
      'Invalid authenticated user'
    );

    error.status = 401;
    throw error;
  }

  return userId;
};

/* ── Validate Draft Owner ─────────────────────────────────── */

const validateDraftOwner = (
  draft,
  senderUserId
) => {
  const userId = validateSender(senderUserId);

  if (!draft) {
    const error = new Error('Email draft not found');
    error.status = 404;
    throw error;
  }

  if (Number(draft.SenderUserID) !== userId) {
    const error = new Error(
      'You are not allowed to modify this email draft'
    );

    error.status = 403;
    throw error;
  }

  return userId;
};

/* ── Create Draft ─────────────────────────────────────────── */

const createDraft = async ({
  senderUserId = null,
  subject = '',
  message = '',
  recipientType = 'all',
  memberIds = [],
  subdistrictId = null,
  unitId = null,
  lifeGroupId = null,
  leadershipLevel = null,
  leadershipLevels = [],
  includeHigherLeadership = false,
} = {}) => {
  const userId = validateSender(senderUserId);

  if (!subject || !subject.trim()) {
    throw new Error('Email subject is required');
  }

  if (!message || !message.trim()) {
    throw new Error('Email message is required');
  }

  const recipientScope = await buildRecipientScope({
    preserveMemberIds: true,
    recipientType,
    subdistrictId,
    unitId,
    lifeGroupId,
    memberIds,
    leadershipLevel,
    leadershipLevels,
    includeHigherLeadership,
  });

  return communicationRepo.createEmailLog({
    senderUserId: userId,
    subject: subject.trim(),
    message: prepareStoredMessage(message),
    recipientScope,
    status: 'Draft',
  });
};

/* ── Update Draft ─────────────────────────────────────────── */

const updateDraft = async (
  emailId,
  {
    senderUserId = null,
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
  } = {}
) => {
  const userId = validateSender(senderUserId);
  const parsedEmailId = Number(emailId);

  if (!Number.isInteger(parsedEmailId) || parsedEmailId <= 0) {
    const error = new Error('Invalid email ID');
    error.status = 400;
    throw error;
  }

  const existingDraft =
    await communicationRepo.getEmailLogById(
      parsedEmailId
    );

  validateDraftOwner(existingDraft, userId);

  if (existingDraft.Status !== 'Draft') {
    const error = new Error(
      'Only draft emails can be updated'
    );

    error.status = 400;
    throw error;
  }

  if (
    subject !== undefined &&
    (!subject || !subject.trim())
  ) {
    throw new Error('Email subject is required');
  }

  if (
    message !== undefined &&
    (!message || !message.trim())
  ) {
    throw new Error('Email message is required');
  }

  let recipientScope;

  if (recipientType !== null) {
    recipientScope = await buildRecipientScope({
      preserveMemberIds: true,
      recipientType,
      subdistrictId,
      unitId,
      lifeGroupId,
      memberIds,
      leadershipLevel,
      leadershipLevels,
      includeHigherLeadership,
    });
  }

  return communicationRepo.updateEmailLog(
    parsedEmailId,
    {
      subject:
        subject !== undefined
          ? subject.trim()
          : undefined,

      message:
        message !== undefined
          ? prepareStoredMessage(message)
          : undefined,

      recipientScope,
    }
  );
};

/* ── Discard Draft ────────────────────────────────────────── */

const discardDraft = async (
  emailId,
  senderUserId
) => {
  const userId = validateSender(senderUserId);
  const parsedEmailId = Number(emailId);

  if (!Number.isInteger(parsedEmailId) || parsedEmailId <= 0) {
    const error = new Error('Invalid email ID');
    error.status = 400;
    throw error;
  }

  const draft =
    await communicationRepo.getEmailLogById(
      parsedEmailId
    );

  validateDraftOwner(draft, userId);

  if (draft.Status !== 'Draft') {
    const error = new Error(
      'Only draft emails can be discarded'
    );

    error.status = 400;
    throw error;
  }

  return communicationRepo.discardEmailDraft(
    parsedEmailId
  );
};

/* ── Send Email ───────────────────────────────────────────── */

const sendEmail = async ({
  emailId = null,
  senderUserId = null,
  subject = '',
  message = '',
  recipientType = 'all',
  memberIds = [],
  subdistrictId = null,
  unitId = null,
  lifeGroupId = null,
  leadershipLevel = null,
  leadershipLevels = [],
  includeHigherLeadership = false,
  attachments = [],
} = {}) => {
  const userId = validateSender(senderUserId);

  if (!subject || !subject.trim()) {
    throw new Error('Email subject is required');
  }

  if (!message || !message.trim()) {
    throw new Error('Email message is required');
  }

  if (!MAILJET_API_KEY) {
    throw new Error(
      'Mailjet API key is not configured'
    );
  }

  if (!MAILJET_SECRET_KEY) {
    throw new Error(
      'Mailjet secret key is not configured'
    );
  }

  if (!MAILJET_FROM_EMAIL) {
    throw new Error(
      'Mailjet sender email is not configured'
    );
  }

  const storedMessage = prepareStoredMessage(message);

  const recipientScope = await buildRecipientScope({
    recipientType,
    subdistrictId,
    unitId,
    lifeGroupId,
    memberIds,
    leadershipLevel,
    leadershipLevels,
    includeHigherLeadership,
  });

  /* ── Get or Create Email Log ───────────────────────────── */

  let emailLog;

  if (emailId !== null) {
    const parsedEmailId = Number(emailId);

    if (
      !Number.isInteger(parsedEmailId) ||
      parsedEmailId <= 0
    ) {
      const error = new Error('Invalid email ID');
      error.status = 400;
      throw error;
    }

    emailLog =
      await communicationRepo.getEmailLogById(
        parsedEmailId
      );

    validateDraftOwner(emailLog, userId);

    if (emailLog.Status !== 'Draft') {
      const error = new Error(
        'Only draft emails can be sent'
      );

      error.status = 400;
      throw error;
    }

    await communicationRepo.updateEmailLog(
      parsedEmailId,
      {
        subject: subject.trim(),
        message: storedMessage,
        recipientScope,
      }
    );

    emailLog =
      await communicationRepo.getEmailLogById(
        parsedEmailId
      );
  } else {
    emailLog =
      await communicationRepo.createEmailLog({
        senderUserId: userId,
        subject: subject.trim(),
        message: storedMessage,
        recipientScope,
        status: 'Draft',
      });
  }

  /* ── Get Recipients ────────────────────────────────────── */

  let recipients;

  try {
    recipients = await getRecipients({
      recipientType,
      memberIds,
      subdistrictId,
      unitId,
      lifeGroupId,
      leadershipLevel,
      leadershipLevels,
      includeHigherLeadership,
    });
  } catch (err) {
    if (emailLog?.EmailID) {
      await communicationRepo.markEmailAsFailed(
        emailLog.EmailID
      );
    }

    throw err;
  }

  if (!recipients.length) {
    if (emailLog?.EmailID) {
      await communicationRepo.markEmailAsFailed(
        emailLog.EmailID
      );
    }

    throw new Error(
      'No active members with valid email addresses were found'
    );
  }

  /* ── Remove Invalid Emails ─────────────────────────────── */

  const validRecipients = recipients.filter((member) =>
    validateEmail(member.Email)
  );

  if (!validRecipients.length) {
    if (emailLog?.EmailID) {
      await communicationRepo.markEmailAsFailed(
        emailLog.EmailID
      );
    }

    throw new Error(
      'No valid recipient email addresses were found'
    );
  }

  /* ── Message Content ───────────────────────────────────── */

  const containsEditorHtml =
    /<\/?(?:p|div|strong|em|ul|ol|li|a|img|br)\b/i.test(
      storedMessage
    );

  const plainMessage = containsEditorHtml
    ? htmlToPlainText(storedMessage)
    : storedMessage;

  const htmlMessage = containsEditorHtml
    ? storedMessage
    : markdownToHtml(storedMessage);

  /* ── Mailjet Payload ───────────────────────────────────── */

  const messages = validRecipients.map((member) => ({
    From: {
      Email: MAILJET_FROM_EMAIL,
      Name: MAILJET_FROM_NAME,
    },

    To: [
      {
        Email: member.Email.trim(),
        Name: `${member.FirstName || ''} ${
          member.LastName || ''
        }`.trim(),
      },
    ],

    Subject: subject.trim(),
    TextPart: plainMessage,
    HTMLPart: htmlMessage,

    Attachments: Array.isArray(attachments)
      ? attachments
          .filter(
            (attachment) =>
              attachment?.filename &&
              attachment?.base64Content
          )
          .map((attachment) => ({
            Filename: attachment.filename,
            ContentType:
              attachment.contentType ||
              'application/octet-stream',
            Base64Content:
              attachment.base64Content,
          }))
      : [],
  }));

  const payload = {
    Messages: messages,
  };

  /* ── Send Through Mailjet ──────────────────────────────── */

  let mailjetResponse;

  try {
    mailjetResponse = await axios.post(
      MAILJET_SEND_URL,
      payload,
      {
        auth: {
          username: MAILJET_API_KEY,
          password: MAILJET_SECRET_KEY,
        },

        headers: {
          'Content-Type': 'application/json',
        },

        timeout: 30000,
      }
    );
  } catch (err) {
    const mailjetData = err.response?.data;

    const mailjetMessage =
      mailjetData?.Messages?.[0]?.Errors?.[0]
        ?.ErrorMessage ||
      mailjetData?.ErrorMessage ||
      err.message ||
      'Unknown Mailjet error';

    if (emailLog?.EmailID) {
      await communicationRepo.markEmailAsFailed(
        emailLog.EmailID
      );
    }

    const mailjetError = new Error(
      `Failed to send email through Mailjet: ${mailjetMessage}`
    );

    mailjetError.status = 502;
    mailjetError.mailjetResponse =
      mailjetData || null;

    throw mailjetError;
  }

  const mailjetMessages =
    mailjetResponse?.data?.Messages;

  if (
    !Array.isArray(mailjetMessages) ||
    mailjetMessages.length === 0
  ) {
    if (emailLog?.EmailID) {
      await communicationRepo.markEmailAsFailed(
        emailLog.EmailID
      );
    }

    const error = new Error(
      'Mailjet returned an unexpected response'
    );

    error.status = 502;
    error.mailjetResponse =
      mailjetResponse?.data || null;

    throw error;
  }

  const failedMailjetMessages =
    mailjetMessages.filter(
      (mail) => mail.Status !== 'success'
    );

  if (failedMailjetMessages.length > 0) {
    if (emailLog?.EmailID) {
      await communicationRepo.markEmailAsFailed(
        emailLog.EmailID
      );
    }

    const mailjetMessage =
      failedMailjetMessages[0]
        ?.Errors?.[0]?.ErrorMessage ||
      'Mailjet rejected the email';

    const error = new Error(
      `Mailjet rejected the email: ${mailjetMessage}`
    );

    error.status = 502;
    error.mailjetResponse =
      mailjetResponse.data;

    throw error;
  }

  /* ── Mark Sent ──────────────────────────────────────────── */

  const sentEmail =
    await communicationRepo.markEmailAsSent(
      emailLog.EmailID
    );

  return {
    success: true,

    emailId:
      sentEmail?.EmailID ??
      emailLog.EmailID ??
      null,

    recipientCount: validRecipients.length,

    recipientScope:
      sentEmail?.RecipientScope ??
      emailLog.RecipientScope ??
      null,

    subject:
      sentEmail?.Subject ??
      subject.trim(),

    sentAt:
      sentEmail?.SentAt ??
      new Date(),

    status:
      sentEmail?.Status ??
      'Sent',

    mailjet: {
      status: mailjetResponse.status,
      messageCount: validRecipients.length,
    },
  };
};

/* ── Email History ────────────────────────────────────────── */

const getEmailHistory = async ({
  search,
  status = null,
  page = 1,
  limit = 10,
} = {}) =>
  communicationRepo.getEmailLogs({
    search,
    status,
    page,
    limit,
  });

const getEmailHistoryById = async (emailId) => {
  if (!emailId) {
    throw new Error('Email ID is required');
  }

  const email =
    await communicationRepo.getEmailLogById(
      emailId
    );

  if (!email) {
    const error = new Error(
      'Email record not found'
    );

    error.status = 404;
    throw error;
  }

  return email;
};

/* ── Drafts ──────────────────────────────────────────────── */

const getDrafts = async ({
  search,
  page = 1,
  limit = 10,
} = {}) =>
  communicationRepo.getDrafts({
    search,
    page,
    limit,
  });

/* ── Recipient Options ───────────────────────────────────── */

const getRecipientOptions = async () => {
  const [
    subdistricts,
    units,
    lifeGroups,
  ] = await Promise.all([
    communicationRepo.getSubdistricts(),
    communicationRepo.getUnits(),
    communicationRepo.getLifeGroups(),
  ]);

  return {
    subdistricts,
    units,
    lifeGroups,
  };
};

/* ── Overview ────────────────────────────────────────────── */

const getCommunicationOverview = async () => {
  const activeMemberCount =
    await communicationRepo.getActiveMemberCount();

  const recentEmails =
    await communicationRepo.getEmailLogs({
      page: 1,
      limit: 5,
    });

  const drafts =
    await communicationRepo.getDrafts({
      page: 1,
      limit: 50,
    });

  return {
    activeMemberCount,
    recentEmails: recentEmails.emails,
    drafts: drafts.emails,
  };
};

/* ── exports ──────────────────────────────────────────────── */

module.exports = {
  getRecipients,
  searchRecipients,
  getRecipientCount,

  createDraft,
  updateDraft,
  discardDraft,
  sendEmail,

  getEmailHistory,
  getEmailHistoryById,
  getDrafts,

  getRecipientOptions,
  getCommunicationOverview,
};
