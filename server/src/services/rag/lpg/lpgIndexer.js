const crypto = require('crypto');
const config = require('../../../config/ragConfig');
const { extractSchema } = require('../structured/schemaExtractor');
const { createCollection, insertVectors } = require('../common/vectorStore');
const { generateEmbeddings } = require('../structured/indexer');
const { writeLpg } = require('./neo4jClient');
const { buildLpgModel } = require('./lpgBuilder');
const { stablePointId } = require('../common/stablePointId');

const indexLpgSchema = async () => {
  const started = performance.now();
  const schema = await extractSchema();
  if (!schema.columns.length) throw new Error('No approved schema columns were extracted.');
  const model = buildLpgModel(schema);
  const runId = crypto.randomUUID();

  await writeLpg(async session => {
    await session.run('CREATE CONSTRAINT schema_node_id IF NOT EXISTS FOR (n:SchemaNode) REQUIRE n.id IS UNIQUE');
    await session.executeWrite(async tx => {
    await tx.run(`UNWIND $rows AS row
      MERGE (n:SchemaNode:Table {id: row.id})
      SET n.name=row.name, n.description=row.description, n.lastIndexed=$runId`, { rows: model.tables, runId });
    await tx.run(`UNWIND $rows AS row
      MERGE (n:SchemaNode:Column {id: row.id})
      SET n.name=row.name, n.table=row.table, n.dataType=row.dataType,
          n.nullable=row.nullable, n.primaryKey=row.primaryKey, n.unique=row.unique,
          n.description=row.description, n.lastIndexed=$runId
      WITH n, row MATCH (t:Table {id: row.tableId}) MERGE (t)-[:HAS_COLUMN]->(n)`,
    { rows: model.columns, runId });
    await tx.run(`UNWIND $rows AS row
      MATCH (a:Column {id: row.fromId}), (b:Column {id: row.toId})
      MERGE (a)-[r:REFERENCES {id: row.id}]->(b)
      SET r.description=row.description, r.lastIndexed=$runId`, { rows: model.foreignKeys, runId });
    await tx.run(`UNWIND $rows AS row
      MERGE (n:SchemaNode:Concept {id: row.id})
      SET n.name=row.name, n.description=row.description, n.sourceTable=row.sourceTable, n.lastIndexed=$runId
      WITH n, row MATCH (t:Table {id: row.tableId})
      MERGE (n)-[r:RELATES_TO]->(t) SET r.verified=true, r.lastIndexed=$runId`, { rows: model.rules, runId });
      await tx.run(`MATCH ()-[r:REFERENCES|RELATES_TO]->()
        WHERE r.lastIndexed IS NULL OR r.lastIndexed <> $runId DELETE r`, { runId });
      await tx.run(`MATCH (n:SchemaNode)
        WHERE n.lastIndexed IS NULL OR n.lastIndexed <> $runId DETACH DELETE n`, { runId });
    });
  });

  const nodes = [...model.tables, ...model.columns, ...model.rules];
  const embeddedNodes = await generateEmbeddings(nodes.map(node => ({ ...node, text: node.description })));
  await createCollection(config.lpgCollection);
  await insertVectors(nodes.map((node, index) => ({
    id: stablePointId(node.id), vector: embeddedNodes[index].vector,
    payload: { nodeId: node.id, type: node.id.split(':')[0], sourceTable: node.table || node.sourceTable || node.name, text: node.description }
  })), config.lpgCollection);

  return {
    collection: config.lpgCollection, tables: model.tables.length,
    columns: model.columns.length, relationships: model.foreignKeys.length,
    concepts: model.rules.length, indexedPoints: nodes.length,
    durationMs: Math.round(performance.now() - started)
  };
};

module.exports = { indexLpgSchema };
