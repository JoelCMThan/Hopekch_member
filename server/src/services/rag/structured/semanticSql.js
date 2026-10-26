const normalizeSemanticNameComparisons = sql => sql.replace(
  /LOWER\s*\(\s*(CONCAT\s*\([^)]*\))\s*\)\s+LIKE/gi,
  "REPLACE(REPLACE(LOWER($1), ' ', ''), '-', '') LIKE"
);

module.exports = { normalizeSemanticNameComparisons };
