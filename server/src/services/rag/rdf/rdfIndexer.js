const config = require('../../../config/ragConfig');
const { extractSchema } = require('../structured/schemaExtractor');
const { generateEmbeddings } = require('../structured/indexer');
const { createCollection, insertVectors } = require('../common/vectorStore');
const { stablePointId } = require('../common/stablePointId');
const { buildRdfModel, GRAPH_URI, uriForId } = require('./rdfBuilder');
const { replaceGraph } = require('./rdfClient');

const indexRdfSchema = async () => {
  const started = performance.now();
  const schema = await extractSchema();
  if (!schema.columns.length) throw new Error('No approved schema columns were extracted.');
  const model = buildRdfModel(schema);
  await replaceGraph(GRAPH_URI, model.triples);
  const embedded = await generateEmbeddings(model.nodes.map(node => ({ ...node, text: node.description })));
  await createCollection(config.rdfCollection);
  await insertVectors(model.nodes.map((node, index) => ({
    id: stablePointId(`rdf:${node.id}`), vector: embedded[index].vector,
    payload: { nodeId: node.id, uri: uriForId(node.id), type: node.id.split(':')[0], sourceTable: node.table || node.sourceTable || node.name, text: node.description }
  })), config.rdfCollection);
  return {
    collection: config.rdfCollection, tables: model.tables.length, columns: model.columns.length,
    relationships: model.foreignKeys.length, concepts: model.rules.length,
    triples: model.triples ? model.triples.split('\n').length : 0,
    indexedPoints: model.nodes.length, durationMs: Math.round(performance.now() - started)
  };
};

module.exports = { indexRdfSchema };
