
const { randomUUID } = require('node:crypto');
const { askRag } = require('../services/rag/structured/structuredRagService');
const { authorizeRagQuestion } = require('../services/rag/structured/ragAuthorization');

const askQuestion = async (req, res) => {
  const requestId = randomUUID().slice(0, 8);
  const requestStart = Date.now();
  const logProgress = (message) => {
    console.log(`[RAG ${requestId}] +${Date.now() - requestStart}ms ${message}`);
  };

  try {
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const architecture = req.body?.architecture || 'structured';
    const history = Array.isArray(req.body?.history)
      ? req.body.history.slice(-8).filter(message =>
        ['user', 'assistant'].includes(message?.role) &&
        typeof message?.content === 'string' &&
        message.content.trim()
      ).map(message => ({
        role: message.role,
        content: message.content.trim().slice(0, 2000)
      }))
      : [];

    logProgress(`Request received (architecture=${architecture}, user=${req.user?.id || req.user?.UserID || 'unknown'})`);

    if (
      !question ||
      typeof question !== 'string' ||
      question.length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid question.'
      });
    }

    if (!['structured', 'lpg', 'rdf'].includes(architecture)) {
      return res.status(400).json({ success: false, message: 'Invalid RAG architecture.' });
    }

    // Gate 1 applies to every submitted question, including greetings.
    logProgress('Authorizing data scope...');
    const authorization = await authorizeRagQuestion(req.user);
    logProgress(`Authorization complete (scope=${authorization.scopeLabel})`);

    if (/^(hi|hello|hey|good morning|good afternoon|good evening)[!.,\s]*$/i.test(question)) {
      logProgress('Greeting handled without retrieval');
      return res.status(200).json({
        success: true,
        data: { architecture, answer: 'Hello! Ask me a question about your church data, such as how many members are in each life group.' }
      });
    }

    if (/^(?:can|could|do|would)\s+(?:(?:you|u)\s+)?(?:generate|create|make|show|draw)?\s*(?:a\s+)?(?:chart|graph|visuali[sz]ation)[?!.\s]*$/i.test(question)) {
      logProgress('Chart capability question handled without retrieval');
      return res.status(200).json({
        success: true,
        data: {
          architecture,
          answer: 'Yes. Tell me what you want to compare, for example: “Show the number of members in each life group as a bar chart.”'
        }
      });
    }

    const result = await askRag(question, authorization, {
      architecture,
      history,
      requestId,
      requestStart
    });
    const canSeeDiagnostics = process.env.RAG_EXPOSE_DIAGNOSTICS === 'true' &&
      ['master_admin', 'admin'].includes(req.user?.role);
    const publicResult = canSeeDiagnostics ? result : {
      architecture: result.architecture,
      answer: result.answer,
      chart: result.chart,
      metrics: result.metrics,
    };

    logProgress('Response sent successfully');
    return res.status(200).json({
      success: true,
      data: publicResult
    });

  } catch (error) {
    console.error(`[RAG ${requestId}] +${Date.now() - requestStart}ms Request failed:`, error);

    if (error.retryAfterSeconds) res.set('Retry-After', String(error.retryAfterSeconds));
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.publicMessage || 'Unable to process the question. Please try again later.',
      code: error.errorCode,
      retryAfterSeconds: error.retryAfterSeconds,
    });
  }
};

module.exports = { askQuestion };
