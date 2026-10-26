
/**
 * Structured Database RAG - Indexer
 *
 * Indexing flow:
 * 1. Extract approved MySQL schema metadata.
 * 2. Convert metadata into semantic chunks.
 * 3. Generate embeddings using Gemini.
 * 4. Store embeddings and metadata in Qdrant.
 *
 * Supported chunk types:
 * - table
 * - column
 * - relationship
 * - business_rule
 *
 * Actual database records are NOT indexed.
 */

const { QdrantClient } = require('@qdrant/js-client-rest');

const config = require('../../../config/ragConfig');

const { extractSchema } = require('./schemaExtractor');
const { chunkSchema } = require('./chunker');

const { embedTexts } = require('../common/embeddingService');

// ============================================
// Configuration
// ============================================

const COLLECTION_NAME = config.collection;

const VECTOR_SIZE = config.embeddingDimensions;

const BATCH_SIZE = 20;
const EMBEDDING_BATCH_INTERVAL_MS = 13000;

const qdrant = new QdrantClient({
  url: config.qdrantUrl
});

// ============================================
// Generate Embeddings in Batches
// ============================================

const generateEmbeddings = async (chunks) => {
  const embeddedChunks = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    if (i > 0) {
      // Each text counts toward Gemini's embedding request quota.
      await new Promise(resolve => setTimeout(resolve, EMBEDDING_BATCH_INTERVAL_MS));
    }
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const texts = batch.map(chunk => chunk.text);

    console.log(
      `Generating embeddings: ${i + 1}-${i + batch.length}/${chunks.length}`
    );

    const vectors = await embedTexts(texts);

    if (!Array.isArray(vectors) || vectors.length !== batch.length) {
      throw new Error(
        'Embedding service returned an unexpected number of vectors.'
      );
    }

    for (let j = 0; j < batch.length; j++) {
      if (
        !Array.isArray(vectors[j]) ||
        vectors[j].length !== VECTOR_SIZE ||
        !vectors[j].every(Number.isFinite)
      ) {
        throw new Error(
          `Invalid embedding returned for chunk ${batch[j].chunkId}.`
        );
      }

      embeddedChunks.push({
        ...batch[j],
        vector: vectors[j]
      });
    }
  }

  return embeddedChunks;
};

// ============================================
// Prepare Qdrant Points
// ============================================

const preparePoints = (embeddedChunks) =>
  embeddedChunks.map(chunk => ({
    id: chunk.chunkId,

    vector: chunk.vector,

    payload: {
      chunkId: chunk.chunkId,
      type: chunk.type,
      sourceTable: chunk.sourceTable,
      ruleId: chunk.ruleId || null,
      text: chunk.text
    }
  }));

// ============================================
// Rebuild Qdrant Collection
// ============================================

/**
 * Rebuilds the structured collection from scratch.
 *
 * This avoids leaving outdated points behind when
 * columns, relationships or business rules change.
 *
 * IMPORTANT:
 * Run indexing during setup or maintenance,
 * not while users are actively querying this collection.
 */
const rebuildCollection = async () => {
  const collections = await qdrant.getCollections();

  const exists = collections.collections.some(
    collection => collection.name === COLLECTION_NAME
  );

  if (exists) {
    console.log(
      `Deleting existing Qdrant collection: ${COLLECTION_NAME}`
    );

    await qdrant.deleteCollection(COLLECTION_NAME);
  }

  console.log(
    `Creating Qdrant collection: ${COLLECTION_NAME}`
  );

  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: {
      size: VECTOR_SIZE,
      distance: 'Cosine'
    }
  });
};

// ============================================
// Upload Points to Qdrant
// ============================================

const uploadPoints = async (points) => {
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);

    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points: batch
    });

    console.log(
      `Indexed ${Math.min(i + BATCH_SIZE, points.length)}/${points.length} chunks`
    );
  }
};

// ============================================
// Main Indexing Function
// ============================================

const indexStructuredSchema = async () => {
  const startTime = performance.now();

  console.log('\n====================================');
  console.log('Structured Database RAG - Indexing');
  console.log('====================================\n');

  // 1. Extract database schema
  console.log('Step 1: Extracting MySQL schema...');

  const { columns, relationships } = await extractSchema();

  if (!columns.length) {
    throw new Error(
      'No schema columns were extracted. Check the database connection and allowedTables configuration.'
    );
  }

  console.log(
    `Extracted ${columns.length} columns and ${relationships.length} relationships.`
  );

  // 2. Generate semantic chunks
  console.log('\nStep 2: Generating semantic chunks...');

  const chunks = chunkSchema(columns, relationships);

  if (!chunks.length) {
    throw new Error('No semantic chunks were generated.');
  }

  const chunkCounts = chunks.reduce((counts, chunk) => {
    counts[chunk.type] = (counts[chunk.type] || 0) + 1;
    return counts;
  }, {});

  console.log(`Generated ${chunks.length} chunks:`);

  for (const [type, count] of Object.entries(chunkCounts)) {
    console.log(`  ${type}: ${count}`);
  }

  // 3. Generate embeddings
  console.log('\nStep 3: Generating Gemini embeddings...');

  const embeddedChunks = await generateEmbeddings(chunks);

  // 4. Prepare vector points
  const points = preparePoints(embeddedChunks);

  // 5. Rebuild Qdrant collection
  console.log('\nStep 4: Preparing Qdrant collection...');

  await rebuildCollection();

  // 6. Upload points
  console.log('\nStep 5: Uploading vectors to Qdrant...');

  await uploadPoints(points);

  // 7. Verify indexed point count
  const collectionInfo = await qdrant.getCollection(COLLECTION_NAME);

  const indexedCount = collectionInfo.points_count;

  if (indexedCount !== points.length) {
    throw new Error(
      `Index verification failed. Expected ${points.length} points, found ${indexedCount}.`
    );
  }

  const durationMs = performance.now() - startTime;

  console.log('\n====================================');
  console.log('Indexing completed successfully!');
  console.log('====================================');

  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Total chunks: ${chunks.length}`);
  console.log(`Indexed points: ${indexedCount}`);
  console.log(`Duration: ${(durationMs / 1000).toFixed(2)} seconds\n`);

  return {
    collection: COLLECTION_NAME,
    totalChunks: chunks.length,
    chunkCounts,
    indexedPoints: indexedCount,
    durationMs
  };
};

module.exports = {
  indexStructuredSchema,
  generateEmbeddings
};
