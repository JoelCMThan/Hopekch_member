// role guard middleware
const { error } = require('../utils/apiResponse');
const { MEMBERS_MODULE_ROLES } = require('../utils/permissions');

/**
 * requireRole(allowedRoles)
 * @param {string[]} allowedRoles - array of role strings permitted to proceed
 * @returns Express middleware
 */
const requireRole = (allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return error(res, 'Unauthenticated', 401);
  }
  if (!allowedRoles.includes(req.user.role)) {
    return error(res, 'You do not have permission to access this resource', 403);
  }
  next();
};

module.exports = { requireRole, MEMBERS_MODULE_ROLES };