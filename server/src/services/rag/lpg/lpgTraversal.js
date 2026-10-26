const config = require('../../../config/ragConfig');
const { readLpg } = require('./neo4jClient');

const plain = value => value && typeof value.toNumber === 'function' ? value.toNumber() : value;

const traverseLpgSchema = async (nodeIds, options = {}) => {
  if (!nodeIds.length) return [];
  const maxHops = Math.min(4, Math.max(1, Number(options.maxHops || config.lpgMaxHops)));
  const limit = Math.min(100, Math.max(1, Number(options.limit || config.lpgResultLimit)));
  return readLpg(async session => {
    const result = await session.executeRead(tx => tx.run(`
      MATCH p=(start:SchemaNode)-[:HAS_COLUMN|REFERENCES|RELATES_TO*0..${maxHops}]-(related:SchemaNode)
      WHERE start.id IN $nodeIds
      RETURN [n IN nodes(p) | {id:n.id, name:n.name, labels:labels(n), description:n.description}] AS nodes,
             [r IN relationships(p) | {type:type(r), id:r.id, description:r.description}] AS relationships,
             length(p) AS hops
      ORDER BY hops ASC LIMIT $limit`, { nodeIds, limit: require('neo4j-driver').int(limit) }));
    return result.records.map(record => ({
      nodes: record.get('nodes'), relationships: record.get('relationships'), hops: plain(record.get('hops'))
    }));
  });
};

module.exports = { traverseLpgSchema };
