const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRdfModel, uriForId, idFromUri, RDF_TYPE } = require('../src/services/rag/rdf/rdfBuilder');
const { allowedUri } = require('../src/services/rag/rdf/rdfTraversal');

const schema = {
  columns: [
    { TABLE_NAME: 'Member', COLUMN_NAME: 'LifeGroupID', COLUMN_TYPE: 'int', IS_NULLABLE: 'YES', COLUMN_KEY: 'MUL' },
    { TABLE_NAME: 'LifeGroup', COLUMN_NAME: 'LifeGroupID', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO', COLUMN_KEY: 'PRI' },
  ],
  relationships: [{
    TABLE_NAME: 'Member', COLUMN_NAME: 'LifeGroupID',
    REFERENCED_TABLE_NAME: 'LifeGroup', REFERENCED_COLUMN_NAME: 'LifeGroupID'
  }]
};

test('RDF model emits stable resources, rdf:type, and verified schema predicates', () => {
  const model = buildRdfModel(schema);
  assert.match(model.triples, new RegExp(RDF_TYPE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(model.triples, /hasColumn/);
  assert.match(model.triples, /references/);
  assert.equal(model.nodes.length, model.tables.length + model.columns.length + model.rules.length);
});

test('RDF resource URI conversion is stable and traversal rejects external URIs', () => {
  const id = 'column:Member.LifeGroupID';
  assert.equal(idFromUri(uriForId(id)), id);
  assert.equal(allowedUri(uriForId(id)), true);
  assert.equal(allowedUri('https://attacker.example/resource'), false);
});

test('RDF indexing output is deterministic and contains no record-level member resources', () => {
  const first = buildRdfModel(schema);
  const second = buildRdfModel(schema);
  assert.equal(first.triples, second.triples);
  assert.doesNotMatch(first.triples, /member%3A1/);
});
