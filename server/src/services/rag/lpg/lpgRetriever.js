const config = require('../../../config/ragConfig');
const { embedQuery } = require('../common/embeddingService');
const { searchVectors } = require('../common/vectorStore');
const { traverseLpgSchema } = require('./lpgTraversal');
const { buildTraversalContext } = require('../common/traversalContextBuilder');

const retrieveLpgContext = async question => {
  const embedding = await embedQuery(question);
  const results = await searchVectors(embedding, config.lpgTopK, config.lpgCollection);
  const retrievedNodes = results.map(result => ({
    nodeId: result.payload.nodeId, type: result.payload.type,
    sourceTable: result.payload.sourceTable, text: result.payload.text, score: result.score
  })).filter(node => node.nodeId);
  if (!retrievedNodes.length) throw new Error('No relevant LPG schema information was retrieved.');
  const paths = await traverseLpgSchema([...new Set(retrievedNodes.map(node => node.nodeId))]);
  return { retrievedNodes, paths, context: buildTraversalContext(retrievedNodes, paths) };
};

module.exports = { retrieveLpgContext };
