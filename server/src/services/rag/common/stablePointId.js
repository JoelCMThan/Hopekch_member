const crypto = require('crypto');

const stablePointId = value => {
  const hex = crypto.createHash('sha256').update(value).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
};

module.exports = { stablePointId };
