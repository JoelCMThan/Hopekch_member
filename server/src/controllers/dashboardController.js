/* server/src/controllers/dashboardController.js */

const {
  getSummaryCounts,
  getGenderDistribution,
  getAgeDistribution,
  getMembershipComposition,
  getStructureCounts,
  getMembersBySubdistrict,
  getMembersByUnit,
  getMembersByGroup,
} = require('../repositories/dashboardRepo');

const { success, error } = require('../utils/apiResponse');
const { ROLES } = require('../utils/permissions');

/* GET /api/dashboard */
const getDashboard = async (req, res) => {
  try {
    const { user } = req;
    const { role } = user;

    const [summary, gender, age, composition, structure] = await Promise.all([
      getSummaryCounts(user),
      getGenderDistribution(user),
      getAgeDistribution(user),
      getMembershipComposition(user),
      getStructureCounts(user),
    ]);

    // Breakdown bar chart — varies by role
    let breakdown = [];
    if (role === ROLES.MASTER_ADMIN || role === ROLES.ADMIN || role === ROLES.MANAGER) {
      breakdown = await getMembersBySubdistrict();
    } else if (role === ROLES.SUBDISTRICT_LEADER) {
      breakdown = await getMembersByUnit(user);
    } else if (role === ROLES.UNIT_LEADER || role === ROLES.ASSISTANT_UNIT_LEADER) {
      breakdown = await getMembersByGroup(user);
    }

    return success(res, {
      summary,
      gender,
      age,
      composition,
      structure,
      breakdown,
    }, 'Dashboard data retrieved');
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = { getDashboard };