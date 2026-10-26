const { success, error } = require('../utils/apiResponse');
const ragConfig = require('../config/ragConfig');
const { getLlmModel, setLlmModel, getLlmApiKeyStatus, setLlmApiKey } = require('../repositories/systemSettingsRepo');

const getLlmSettings = async (_req, res) => {
  try {
    const model = await getLlmModel();
    const keyStatus = await getLlmApiKeyStatus();
    return success(res, {
      model,
      models: ragConfig.chatModels,
      apiConfigured: keyStatus.configured,
    }, 'LLM settings retrieved');
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const updateLlmSettings = async (req, res) => {
  try {
    const model = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
    if (!ragConfig.isSupportedChatModel(model)) {
      return error(res, 'Please select a supported LLM model.', 400);
    }
    await setLlmModel(model, req.user.userId || req.user.id || req.user.UserID);
    return success(res, { model }, 'LLM model updated');
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const updateLlmApiKey = async (req, res) => {
  try {
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    if (apiKey.length < 10 || apiKey.length > 500) return error(res, 'Please provide a valid API key.', 400);
    await setLlmApiKey(apiKey, req.user.userId || req.user.id || req.user.UserID);
    return success(res, { apiConfigured: true }, 'Gemini API key updated');
  } catch (err) {
    return error(res, err.message, 500);
  }
};

module.exports = { getLlmSettings, updateLlmSettings, updateLlmApiKey };
