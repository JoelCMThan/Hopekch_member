const Joi = require('joi');
const { VALID_ROLES } = require('../utils/permissions');

const registerSchema = Joi.object({
  /* ── Credentials ───────────────────────────────────────── */
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'string.empty': 'Email is required',
    }),

  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'string.empty': 'Password is required',
    }),

  role: Joi.string()
    .valid(...VALID_ROLES)
    .default('member'),

  /* ── Personal ──────────────────────────────────────────── */
  firstName: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'First name is required',
    }),

  lastName: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Last name is required',
    }),

  gender: Joi.string()
    .valid('Male', 'Female')
    .required()
    .messages({
      'any.only': 'Gender must be Male or Female',
      'string.empty': 'Gender is required',
    }),

  birthDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'Birth date must be YYYY-MM-DD',
      'string.empty': 'Birth date is required',
    }),

  maritalStatus: Joi.string()
    .valid('Single', 'Married', 'Divorced', 'Widowed')
    .required()
    .messages({
      'any.only': 'Marital status must be Single, Married, Divorced, or Widowed',
      'string.empty': 'Marital status is required',
    }),

  /* ── Church ────────────────────────────────────────────── */
  membershipType: Joi.string()
    .valid('Member', 'Visitor', 'Consistent Visitor')
    .max(100)
    .optional()
    .allow('')
    .default('Member'),

  believerStatus: Joi.string()
    .valid('Pre-believer', 'Believer', 'New Believer')
    .optional()
    .allow('', null)
    .when('membershipType', {
      is: Joi.valid('Visitor', 'Consistent Visitor'),
      then: Joi.string().required().messages({
        'any.required': 'Believer status is required for Visitor and Consistent Visitor',
      }),
      otherwise: Joi.any().optional().allow('', null),
    }),

  joinDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .allow(''),

  memberSince: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .allow('', null),

  /* ── Contact ───────────────────────────────────────────── */
  mobileNumber: Joi.string()
    .max(50)
    .optional()
    .allow(''),

  landlineNumber: Joi.string()
    .max(50)
    .optional()
    .allow(''),

  /* ── Address ───────────────────────────────────────────── */
  streetAddress: Joi.string()
    .optional()
    .allow('', null),

  city: Joi.string()
    .max(100)
    .optional()
    .allow('', null),

  state: Joi.string()
    .max(100)
    .optional()
    .allow('', null),

  postalCode: Joi.string()
    .max(20)
    .optional()
    .allow('', null),

  country: Joi.string()
    .max(100)
    .optional()
    .allow('', null),

  /* ── Baptism ───────────────────────────────────────────── */
  isBaptized: Joi.boolean()
    .optional()
    .default(false),

  baptismDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .allow('', null),

  baptismVenue: Joi.string()
    .max(255)
    .optional()
    .allow('', null),

  baptismRemarks: Joi.string()
    .optional()
    .allow('', null),
});

const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'string.empty': 'Email is required',
    }),

  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required',
    }),
});

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    const errors = error.details.map((d) => d.message);

    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  next();
};

module.exports = {
  validateRegister: validate(registerSchema),
  validateLogin: validate(loginSchema),
};
