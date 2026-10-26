
/**
 * Common RAG Evaluation Service
 *
 * Shared across:
 * 1. Structured Database RAG
 * 2. RDF RAG
 * 3. LPG RAG
 */

/**
 * Normalize answers for basic exact-match evaluation.
 */
const normalizeAnswer = (answer) => {
  if (answer === null || answer === undefined) {
    return '';
  }

  return String(answer)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?]+$/g, '');
};

/**
 * Calculate Precision@K.
 *
 * relevantRetrieved / K
 */
const precisionAtK = (
  retrievedIds,
  relevantIds,
  k = 5
) => {
  if (k <= 0) return 0;

  const relevant = new Set(relevantIds);

  const retrieved = retrievedIds.slice(0, k);

  const hits = retrieved.filter(
    id => relevant.has(id)
  ).length;

  return hits / k;
};

/**
 * Calculate Recall@K.
 *
 * relevantRetrieved / totalRelevant
 */
const recallAtK = (
  retrievedIds,
  relevantIds,
  k = 5
) => {
  if (!relevantIds.length) return 0;

  const relevant = new Set(relevantIds);

  const retrieved = new Set(
    retrievedIds.slice(0, k)
  );

  let hits = 0;

  for (const id of relevant) {
    if (retrieved.has(id)) {
      hits++;
    }
  }

  return hits / relevant.size;
};

/**
 * Hit@K:
 * 1 = at least one relevant chunk retrieved.
 * 0 = no relevant chunks retrieved.
 */
const hitAtK = (
  retrievedIds,
  relevantIds,
  k = 5
) => {
  const relevant = new Set(relevantIds);

  return retrievedIds
    .slice(0, k)
    .some(id => relevant.has(id))
      ? 1
      : 0;
};

/**
 * Mean Reciprocal Rank for a single question.
 *
 * Reciprocal rank = 1 / position of first relevant chunk.
 *
 * Average this result across all test questions
 * to obtain dataset-level MRR.
 */
const reciprocalRank = (
  retrievedIds,
  relevantIds
) => {
  const relevant = new Set(relevantIds);

  const index = retrievedIds.findIndex(
    id => relevant.has(id)
  );

  return index === -1
    ? 0
    : 1 / (index + 1);
};

/**
 * Exact-match answer accuracy.
 */
const answerAccuracy = (
  predictedAnswer,
  expectedAnswer
) => {
  return normalizeAnswer(predictedAnswer) ===
    normalizeAnswer(expectedAnswer)
      ? 1
      : 0;
};

/**
 * Evaluate one RAG question.
 */
const evaluateQuery = ({
  retrievedIds = [],
  relevantIds = [],
  predictedAnswer = '',
  expectedAnswer = '',
  k = 5,
  metrics = {},
  usage = {}
}) => {
  const precision = precisionAtK(
    retrievedIds,
    relevantIds,
    k
  );

  const recall = recallAtK(
    retrievedIds,
    relevantIds,
    k
  );

  const hit = hitAtK(
    retrievedIds,
    relevantIds,
    k
  );

  const mrr = reciprocalRank(
    retrievedIds,
    relevantIds
  );

  const accuracy = answerAccuracy(
    predictedAnswer,
    expectedAnswer
  );

  return {
    retrieval: {
      precisionAtK: precision,
      recallAtK: recall,
      hitAtK: hit,
      reciprocalRank: mrr
    },

    answer: {
      exactMatch: accuracy
    },

    performance: {
      retrievalTimeMs:
        metrics.retrievalTimeMs ?? 0,

      generationTimeMs:
        metrics.generationTimeMs ?? 0,

      executionTimeMs:
        metrics.executionTimeMs ?? 0,

      totalTimeMs:
        metrics.totalTimeMs ?? 0
    },

    tokens: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,

      totalTokens:
        (usage.inputTokens ?? 0) +
        (usage.outputTokens ?? 0)
    }
  };
};

/**
 * Calculate average metrics across multiple questions.
 */
const averageResults = (results) => {
  if (!results.length) return null;

  const average = (values) =>
    values.reduce((sum, value) => sum + value, 0) /
    values.length;

  return {
    totalQuestions: results.length,

    averagePrecision: average(
      results.map(r => r.retrieval.precisionAtK)
    ),

    averageRecall: average(
      results.map(r => r.retrieval.recallAtK)
    ),

    hitRate: average(
      results.map(r => r.retrieval.hitAtK)
    ),

    mrr: average(
      results.map(r => r.retrieval.reciprocalRank)
    ),

    answerAccuracy: average(
      results.map(r => r.answer.exactMatch)
    ),

    averageLatencyMs: average(
      results.map(r => r.performance.totalTimeMs)
    ),

    averageTokens: average(
      results.map(r => r.tokens.totalTokens)
    )
  };
};

module.exports = {
  normalizeAnswer,
  precisionAtK,
  recallAtK,
  hitAtK,
  reciprocalRank,
  answerAccuracy,
  evaluateQuery,
  averageResults
};
