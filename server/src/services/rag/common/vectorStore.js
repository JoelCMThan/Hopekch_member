
const { QdrantClient } =
  require('@qdrant/js-client-rest');

const config = require('../../../config/ragConfig');

const qdrant = new QdrantClient({
  url: config.qdrantUrl
});

const createCollection = async (collectionName = config.collection) => {
  const collections = await qdrant.getCollections();

  const exists = collections.collections.some(
    c => c.name === collectionName
  );

  if (exists) {
    await qdrant.deleteCollection(collectionName);
  }

  await qdrant.createCollection(collectionName, {
    vectors: {
      size: config.embeddingDimensions,
      distance: 'Cosine'
    }
  });
};

const insertVectors = async (points, collectionName = config.collection) => {
  await qdrant.upsert(collectionName, {
    wait: true,
    points
  });
};

const searchVectors = async (embedding, limit, collectionName = config.collection) => {
  const result = await qdrant.query(collectionName, {
    query: embedding,
    limit,
    with_payload: true
  });
  return result.points;
};

module.exports = {
  createCollection,
  insertVectors,
  searchVectors
};
