const { buildLpgModel } = require('../lpg/lpgBuilder');

const NS = 'urn:hope-church:schema:';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const GRAPH_URI = `${NS}graph`;
const uriForId = id => `${NS}resource/${encodeURIComponent(id)}`;
const idFromUri = uri => decodeURIComponent(String(uri).slice(`${NS}resource/`.length));
const predicate = name => `${NS}${name}`;
const literal = value => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`;
const triple = (s, p, o, objectIsUri = false) => `<${s}> <${p}> ${objectIsUri ? `<${o}>` : literal(o)} .`;

const buildRdfModel = schema => {
  const model = buildLpgModel(schema);
  const lines = [];
  const addNode = (node, type) => {
    const uri = uriForId(node.id);
    lines.push(triple(uri, RDF_TYPE, predicate(type), true));
    lines.push(triple(uri, predicate('identifier'), node.id));
    lines.push(triple(uri, predicate('name'), node.name));
    lines.push(triple(uri, predicate('description'), node.description));
  };
  model.tables.forEach(node => addNode(node, 'Table'));
  model.columns.forEach(node => {
    addNode(node, 'Column');
    lines.push(triple(uriForId(node.id), predicate('dataType'), node.dataType));
    lines.push(triple(uriForId(node.tableId), predicate('hasColumn'), uriForId(node.id), true));
  });
  model.rules.forEach(node => {
    addNode(node, 'Concept');
    lines.push(triple(uriForId(node.id), predicate('relatesTo'), uriForId(node.tableId), true));
  });
  model.foreignKeys.forEach(rel => {
    lines.push(triple(uriForId(rel.fromId), predicate('references'), uriForId(rel.toId), true));
  });
  return { ...model, triples: lines.join('\n'), nodes: [...model.tables, ...model.columns, ...model.rules] };
};

module.exports = { NS, GRAPH_URI, RDF_TYPE, uriForId, idFromUri, predicate, buildRdfModel };
