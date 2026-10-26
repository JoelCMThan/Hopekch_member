/* server/src/controllers/analyticsController.js */

const {
  getAnalyticsData,
  getSubdistrictOptions,
  getUnitOptions,
  getLifeGroupOptions,
  saveSundayAttendance,
} = require('../repositories/analyticsRepo');

const { success, error } = require('../utils/apiResponse');

/* ── GET /api/analytics ─────────────────────────────────────── */

const getAnalytics = async (req, res) => {
  try {
    const { user } = req;

    const filters = {
      dateRange: req.query.dateRange || '1y',
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      subdistrictId: req.query.subdistrictId || null,
      unitId: req.query.unitId || null,
      lifeGroupId: req.query.lifeGroupId || null,
    };

    const data = await getAnalyticsData(user, filters);

    return success(
      res,
      data,
      'Analytics data retrieved'
    );
  } catch (err) {
    console.error('getAnalytics error:', err);
    return error(res, err.message, 500);
  }
};

/* ── GET /api/analytics/filters ─────────────────────────────── */

const getAnalyticsFilters = async (req, res) => {
  try {
    const { user } = req;
    const unitId = req.query.unitId || null;
    const subdistrictId = req.query.subdistrictId || null;

    const [units, lifeGroups, subdistricts] = await Promise.all([
      getUnitOptions(user, subdistrictId),
      getLifeGroupOptions(user, unitId, subdistrictId),
      getSubdistrictOptions(user),
    ]);

    return success(
      res,
      {
        units,
        subdistricts,
        lifeGroups,
      },
      'Analytics filters retrieved'
    );
  } catch (err) {
    console.error('getAnalyticsFilters error:', err);
    return error(res, err.message, 500);
  }
};

const recordSundayAttendance = async (req, res) => {
  try {
    const serviceDate = String(req.body.serviceDate || '');
    const attendanceCount = Number(req.body.attendanceCount);
    const remarks = String(req.body.remarks || '').trim();
    const parsedDate = new Date(`${serviceDate}T00:00:00Z`);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== serviceDate) {
      return error(res, 'A valid service date is required', 400);
    }
    if (parsedDate.getUTCDay() !== 0) {
      return error(res, 'Sunday service attendance must use a Sunday date', 400);
    }
    if (!Number.isInteger(attendanceCount) || attendanceCount < 0) {
      return error(res, 'Attendance must be a whole number of zero or more', 400);
    }
    if (remarks.length > 1000) return error(res, 'Remarks must be 1000 characters or fewer', 400);

    const data = await saveSundayAttendance({ serviceDate, attendanceCount, remarks });
    return success(res, data, data.updated ? 'Attendance updated' : 'Attendance recorded', data.updated ? 200 : 201);
  } catch (err) {
    console.error('recordSundayAttendance error:', err);
    return error(res, err.message, 500);
  }
};

module.exports = {
  getAnalytics,
  getAnalyticsFilters,
  recordSundayAttendance,
};
