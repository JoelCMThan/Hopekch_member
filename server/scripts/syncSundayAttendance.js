const mysql = require('mysql2/promise');
require('dotenv').config();

const START_DATE = new Date(Date.UTC(2024, 0, 7));
const END_DATE = new Date(Date.UTC(2026, 9, 25));

const buildAttendanceRows = () => {
  const rows = [];
  let attendanceSeed = 20261026;

  for (let week = 0; ; week += 1) {
    const service = new Date(START_DATE.getTime() + week * 7 * 86400000);
    if (service > END_DATE) break;

    const serviceDate = service.toISOString().slice(0, 10);
    attendanceSeed = (attendanceSeed * 1664525 + 1013904223) >>> 0;
    const randomOffset = (attendanceSeed % 151) - 75;
    const gradualTrend = Math.round(week * 0.28);
    const eventBoost = week % 17 === 0 ? 28 : week % 13 === 0 ? 16 : 0;
    let attendanceCount = Math.max(
      205,
      Math.min(445, 285 + gradualTrend + randomOffset + eventBoost)
    );
    if (week === 0) attendanceCount = 190;
    if (week === 26) attendanceCount = 458;
    const remarks = week % 13 === 0
      ? 'Communion Sunday service'
      : week % 17 === 0
        ? 'Family Sunday service'
        : 'Sunday worship service';

    rows.push([serviceDate, 'Sunday Service', attendanceCount, remarks]);
  }

  return rows;
};

const syncSundayAttendance = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const rows = buildAttendanceRows();

  try {
    await connection.beginTransaction();

    for (let start = 0; start < rows.length; start += 100) {
      const batch = rows.slice(start, start + 100);
      const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');

      await connection.execute(`
        INSERT INTO ServiceAttendance
          (ServiceDate, SessionTime, AttendanceCount, Remarks)
        VALUES ${placeholders}
        ON DUPLICATE KEY UPDATE
          AttendanceCount = VALUES(AttendanceCount),
          Remarks = VALUES(Remarks)
      `, batch.flat());
    }

    const [result] = await connection.execute(`
      SELECT
        COUNT(*) AS rowCount,
        DATE_FORMAT(MIN(ServiceDate), '%Y-%m-%d') AS firstDate,
        DATE_FORMAT(MAX(ServiceDate), '%Y-%m-%d') AS lastDate,
        MIN(AttendanceCount) AS minCount,
        MAX(AttendanceCount) AS maxCount
      FROM ServiceAttendance
      WHERE SessionTime = 'Sunday Service'
    `);

    const summary = result[0];
    if (
      Number(summary.rowCount) !== rows.length
      || summary.firstDate !== '2024-01-07'
      || summary.lastDate !== '2026-10-25'
    ) {
      throw new Error(`Attendance verification failed: ${JSON.stringify(summary)}`);
    }

    await connection.commit();
    console.log(JSON.stringify(summary));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
};

syncSundayAttendance().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
