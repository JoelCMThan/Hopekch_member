const config = require('../../../config/ragConfig');
const { embedQuery } = require('../common/embeddingService');
const { searchVectors } = require('../common/vectorStore');
const { buildTraversalContext } = require('../common/traversalContextBuilder');
const { traverseRdf } = require('./rdfTraversal');

const retrieveRdfContext = async question => {
  const embedding = await embedQuery(question);
  const results = await searchVectors(embedding, config.rdfTopK, config.rdfCollection);
  const retrievedNodes = results.map(result => ({
    nodeId: result.payload.nodeId, uri: result.payload.uri, type: result.payload.type,
    sourceTable: result.payload.sourceTable, text: result.payload.text, score: result.score
  })).filter(node => node.nodeId);
  if (!retrievedNodes.length) throw new Error('No relevant RDF schema information was retrieved.');
  const paths = await traverseRdf(retrievedNodes.map(node => node.nodeId));
  return { retrievedNodes, paths, context: buildTraversalContext(retrievedNodes, paths) };
};

module.exports = { retrieveRdfContext };
