const { pool } = require('../config/db');
const ragConfig = require('../config/ragConfig');
const crypto = require('node:crypto');

const LLM_MODEL_KEY = 'llm_chat_model';
const LLM_API_KEY = 'llm_api_key';
const LLM_API_KEY_PREFIX = 'llm_api_key:';

const encryptionKey = () => {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error('SETTINGS_ENCRYPTION_KEY or JWT_SECRET must be configured');
  return crypto.createHash('sha256').update(secret).digest();
};

const encrypt = value => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
};

const decrypt = value => {
  const [version, iv, tag, encrypted] = String(value).split(':');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Stored LLM API key is invalid');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
};

const getLlmModel = async () => {
  const [rows] = await pool.execute(
    'SELECT SettingValue FROM SystemSetting WHERE SettingKey = ?',
    [LLM_MODEL_KEY]
  );
  const savedModel = rows[0]?.SettingValue;
  if (ragConfig.isSupportedChatModel(savedModel)) return savedModel;
  if (ragConfig.isSupportedChatModel(ragConfig.chatModel)) return ragConfig.chatModel;
  return ragConfig.defaultChatModel;
};

const setLlmModel = async (model, userId) => {
  await pool.execute(
    `INSERT INTO SystemSetting (SettingKey, SettingValue, UpdatedByUserID)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       SettingValue = VALUES(SettingValue),
       UpdatedByUserID = VALUES(UpdatedByUserID),
       UpdatedAt = CURRENT_TIMESTAMP`,
    [LLM_MODEL_KEY, model, userId || null]
  );
};

const getStoredLlmApiKey = async () => {
  const [rows] = await pool.execute(
    `SELECT SettingKey, SettingValue
       FROM SystemSetting
      WHERE SettingKey = ? OR LEFT(SettingKey, ?) = ?
      ORDER BY CASE WHEN SettingKey = ? THEN 0 ELSE 1 END, UpdatedAt DESC
      LIMIT 1`,
    [LLM_API_KEY, LLM_API_KEY_PREFIX.length, LLM_API_KEY_PREFIX, LLM_API_KEY]
  );
  return rows[0] || null;
};

const getLlmApiKeyStatus = async () => ({ configured: Boolean(await getStoredLlmApiKey()) });

const getLlmApiKey = async () => {
  const stored = await getStoredLlmApiKey();
  return stored?.SettingValue ? decrypt(stored.SettingValue) : null;
};

const setLlmApiKey = async (apiKey, userId) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO SystemSetting (SettingKey, SettingValue, UpdatedByUserID)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE SettingValue = VALUES(SettingValue),
         UpdatedByUserID = VALUES(UpdatedByUserID), UpdatedAt = CURRENT_TIMESTAMP`,
      [LLM_API_KEY, encrypt(apiKey), userId || null]
    );
    await conn.execute(
      'DELETE FROM SystemSetting WHERE LEFT(SettingKey, ?) = ?',
      [LLM_API_KEY_PREFIX.length, LLM_API_KEY_PREFIX]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = { getLlmModel, setLlmModel, getLlmApiKeyStatus, getLlmApiKey, setLlmApiKey };
