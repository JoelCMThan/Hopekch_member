const neo4j = require('neo4j-driver');

let driver;

const getDriver = () => {
  if (!driver) {
    const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env;
    if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
      const error = new Error('LPG RAG is not configured. Set NEO4J_URI, NEO4J_USERNAME and NEO4J_PASSWORD.');
      error.statusCode = 503;
      error.publicMessage = error.message;
      throw error;
    }
    driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD));
  }
  return driver;
};

const readLpg = async (work) => {
  const session = getDriver().session({ defaultAccessMode: neo4j.session.READ });
  try { return await work(session); } finally { await session.close(); }
};

const writeLpg = async (work) => {
  const session = getDriver().session({ defaultAccessMode: neo4j.session.WRITE });
  try { return await work(session); } finally { await session.close(); }
};

const closeDriver = async () => {
  if (driver) await driver.close();
  driver = undefined;
};

module.exports = { getDriver, readLpg, writeLpg, closeDriver };
