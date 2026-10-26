
const { pool } = require('../../../config/db');
const config = require('../../../config/ragConfig');

/**
 * Extract database schema metadata from MySQL.
 */
const extractSchema = async () => {
  const [columns] = await pool.query(`
    SELECT
      TABLE_NAME,
      COLUMN_NAME,
      COLUMN_TYPE,
      IS_NULLABLE,
      COLUMN_KEY,
      COLUMN_COMMENT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);

  const [relationships] = await pool.query(`
    SELECT
      TABLE_NAME,
      COLUMN_NAME,
      REFERENCED_TABLE_NAME,
      REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `);

  const allowedTables = new Set(config.allowedTables.map(table => table.toLowerCase()));

  return {
    columns: columns.filter(
      column => allowedTables.has(column.TABLE_NAME.toLowerCase())
    ),

    relationships: relationships.filter(
      relationship =>
        allowedTables.has(relationship.TABLE_NAME.toLowerCase()) &&
        allowedTables.has(
          relationship.REFERENCED_TABLE_NAME.toLowerCase()
        )
    )
  };
};

module.exports = { extractSchema };
