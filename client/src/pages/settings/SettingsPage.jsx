import { useEffect, useState } from 'react';
import memberService from '../../services/memberService';
import settingsService from '../../services/settingsService';
import ConfirmDialog from '../../components/layout/ConfirmDialog';
import './Settings.css';

const SettingsPage = () => {
  const [configured, setConfigured] = useState(null);
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [llmModel, setLlmModel] = useState('');
  const [llmModels, setLlmModels] = useState([]);
  const [llmApiKey, setLlmApiKey] = useState('');
  const [apiConfigured, setApiConfigured] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [llmLoading, setLlmLoading] = useState(true);
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmFeedback, setLlmFeedback] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    memberService.getBulkImportPasswordStatus()
      .then(response => {
        setConfigured(Boolean(response.data?.data?.configured));
        setPasswordUpdatedAt(response.data?.data?.updatedAt || null);
      })
      .catch(error => setFeedback({ type: 'error', text: error.response?.data?.message || 'Unable to load settings.' }));

    settingsService.getLlmSettings()
      .then(response => {
        const data = response.data?.data;
        setLlmModel(data?.model || '');
        setLlmModels(data?.models || []);
        setApiConfigured(Boolean(data?.apiConfigured));
      })
      .catch(error => setLlmFeedback({ type: 'error', text: error.response?.data?.message || 'Unable to load LLM settings.' }))
      .finally(() => setLlmLoading(false));
  }, []);

  const requestPasswordUpdate = event => {
    event.preventDefault();
    setFeedback(null);
    if (password.length < 8) {
      setFeedback({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      setFeedback({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setConfirmation({
      type: 'password',
      title: 'Update Default Password?',
      message: 'This will change the password for future imports and accounts still using the previous shared default.',
      confirmLabel: 'Update Password',
    });
  };

  const performPasswordUpdate = async () => {
    setSaving(true);
    try {
      const response = await memberService.updateBulkImportPassword(password);
      setPassword('');
      setConfirmPassword('');
      setConfigured(true);
      setPasswordUpdatedAt(response.data?.data?.updatedAt || new Date().toISOString());
      setFeedback({ type: 'success', text: 'Default password updated. Accounts still using the previous shared password were updated too.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.response?.data?.message || 'Unable to update the default password.' });
    } finally {
      setSaving(false);
      setConfirmation(null);
    }
  };

  const requestLlmUpdate = event => {
    event.preventDefault();
    setLlmFeedback(null);
    const label = llmModels.find(item => item.value === llmModel)?.label || llmModel;
    setConfirmation({
      type: 'model',
      title: 'Change AI Model?',
      message: `New AI assistant requests will use ${label}.`,
      confirmLabel: 'Save AI Model',
    });
  };

  const performLlmUpdate = async () => {
    setLlmSaving(true);
    try {
      await settingsService.updateLlmModel(llmModel);
      setLlmFeedback({ type: 'success', text: 'LLM model updated. New assistant requests will use this model.' });
    } catch (error) {
      setLlmFeedback({ type: 'error', text: error.response?.data?.message || 'Unable to update the LLM model.' });
    } finally {
      setLlmSaving(false);
      setConfirmation(null);
    }
  };

  const requestApiKeyUpdate = () => {
    const apiKey = llmApiKey.trim();
    setLlmFeedback(null);
    if (apiKey.length < 10) {
      setLlmFeedback({ type: 'error', text: 'Please enter a valid API key.' });
      return;
    }
    setConfirmation({
      type: 'apiKey',
      title: apiConfigured ? 'Replace Gemini API Key?' : 'Save Gemini API Key?',
      message: `This will ${apiConfigured ? 'replace the existing' : 'save a new'} API key used by all Gemini models. The saved value cannot be viewed later.`,
      confirmLabel: apiConfigured ? 'Replace Key' : 'Save Key',
    });
  };

  const performApiKeyUpdate = async () => {
    const apiKey = llmApiKey.trim();
    setKeySaving(true);
    try {
      await settingsService.updateLlmApiKey(apiKey);
      setLlmApiKey('');
      setApiConfigured(true);
      setLlmFeedback({ type: 'success', text: 'Gemini API key updated. All Gemini models will use this key.' });
    } catch (error) {
      setLlmFeedback({ type: 'error', text: error.response?.data?.message || 'Unable to update the API key.' });
    } finally {
      setKeySaving(false);
      setConfirmation(null);
    }
  };

  const confirmAction = () => {
    if (confirmation?.type === 'model') return performLlmUpdate();
    if (confirmation?.type === 'apiKey') return performApiKeyUpdate();
    if (confirmation?.type === 'password') return performPasswordUpdate();
  };

  const formattedPasswordUpdatedAt = passwordUpdatedAt
    ? new Date(passwordUpdatedAt).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Never';

  return <div className="settings-page">
    <header className="settings-page__header">
      <div>
        <h1>Settings</h1>
        <p>Manage system-level configuration and account provisioning.</p>
      </div>
    </header>

    <section className="settings-card">
      <div className="settings-card__heading">
        <span className="material-symbols-outlined" aria-hidden="true">smart_toy</span>
        <div>
          <h2>AI Model</h2>
          <p>Select the Gemini model used by the Hope AI assistant.</p>
        </div>
      </div>

      <form className="settings-form" onSubmit={requestLlmUpdate}>
        <div className="settings-form__model-row">
          <label>
            <span>LLM model</span>
            <select className="form-input" value={llmModel} onChange={event => setLlmModel(event.target.value)} disabled={llmLoading || llmSaving}>
              {llmLoading && <option value="">Loading models...</option>}
              {llmModels.map(model => <option key={model.value} value={model.value}>{model.label}</option>)}
            </select>
          </label>
          <button type="submit" className="btn btn--primary btn--md" disabled={llmLoading || llmSaving || !llmModel}>
            {llmSaving ? 'Saving...' : 'Save AI Model'}
          </button>
        </div>
      </form>

      <div className="settings-api-keys">
        <div className="settings-api-keys__heading">
          <h3>Gemini API key</h3>
          <p>One shared key is used by every Gemini chat and embedding model.</p>
        </div>
        <div className="settings-api-key">
          <div className="settings-api-key__model">
            <strong>Google Gemini</strong>
            <span className={`settings-api-key__status settings-api-key__status--${apiConfigured ? 'configured' : 'missing'}`}>
              <span className="material-symbols-outlined" aria-hidden="true">{apiConfigured ? 'check_circle' : 'warning'}</span>
              {apiConfigured ? 'Configured' : 'No API key'}
            </span>
          </div>
          <input
            className="form-input"
            type="password"
            value={llmApiKey}
            onChange={event => setLlmApiKey(event.target.value)}
            placeholder={apiConfigured ? 'Enter a replacement key' : 'Enter API key'}
            autoComplete="new-password"
          />
          <button type="button" className="btn btn--ghost btn--md" disabled={keySaving || !llmApiKey.trim()} onClick={requestApiKeyUpdate}>
            {keySaving ? 'Saving...' : apiConfigured ? 'Replace Key' : 'Save Key'}
          </button>
        </div>
      </div>
      <p className="settings-form__help">The saved key is never returned to the browser.</p>
      {llmFeedback && <div className={`settings-feedback settings-feedback--${llmFeedback.type}`} role="status">{llmFeedback.text}</div>}
    </section>

    <section className="settings-card">
      <div className="settings-card__heading">
        <span className="material-symbols-outlined" aria-hidden="true">password</span>
        <div>
          <h2>Bulk Import Default Password</h2>
          <p>Used for every member account created through bulk import.</p>
        </div>
      </div>

      <div className={`settings-status ${configured === false ? 'settings-status--warning' : ''}`}>
        <span className="material-symbols-outlined" aria-hidden="true">{configured === false ? 'warning' : 'check_circle'}</span>
        {configured === null ? 'Checking configuration…' : configured ? 'A default password is configured.' : 'No default password is configured.'}
      </div>

      <p className="settings-card__explanation">
        Changing this password affects future imports and imported accounts that still use the previous default. Members who have chosen a personal password are not affected.
      </p>

      <p className="settings-card__updated">Last changed: {formattedPasswordUpdatedAt}</p>

      <form className="settings-form" onSubmit={requestPasswordUpdate}>
        <div className="settings-form__grid">
          <label>
            <span>New default password</span>
            <input className="form-input" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" placeholder="Minimum 8 characters" />
          </label>
          <label>
            <span>Confirm new default password</span>
            <input className="form-input" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Re-enter password" />
          </label>
        </div>
        <label className="settings-form__toggle">
          <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(value => !value)} />
          <span>Show passwords</span>
        </label>
        {feedback && <div className={`settings-feedback settings-feedback--${feedback.type}`} role="status">{feedback.text}</div>}
        <div className="settings-form__actions">
          <button type="submit" className="btn btn--primary btn--md" disabled={saving || !password || !confirmPassword}>
            {saving ? 'Updating…' : 'Update Default Password'}
          </button>
        </div>
      </form>
    </section>
    {confirmation && (
      <ConfirmDialog
        title={confirmation.title}
        message={confirmation.message}
        confirmLabel={confirmation.confirmLabel}
        pending={saving || llmSaving || Boolean(keySaving)}
        onConfirm={confirmAction}
        onCancel={() => setConfirmation(null)}
      />
    )}
  </div>;
};

export default SettingsPage;
