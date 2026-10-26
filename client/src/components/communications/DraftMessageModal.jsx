import { useEffect, useRef, useState } from 'react';
import communicationService from '../../services/communicationService';
import ConfirmDialog from '../layout/ConfirmDialog';
import { CloseIcon } from '../icons';
import './CommunicationModal.css';

const savedContentToHtml = (value) => {
  if (!value) return '';

  if (/<\/?(?:strong|em|ul|ol|li|a|img|br)\b/i.test(value)) {
    return value;
  }

  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
};

const LEADERSHIP_LEVELS = [
  { value: 'all', label: 'All leaders' },
  { value: 'admin', label: 'All Admins' },
  { value: 'manager', label: 'All Managers' },
  { value: 'subdistrict_leader', label: 'All Subdistrict Leaders' },
  { value: 'unit_leaders', label: 'All Unit / Assistant Unit Leaders' },
  { value: 'lg_leaders', label: 'All LG / Assistant LG Leaders' },
];

const LEADERSHIP_ROLE_VALUES = {
  all: ['all'],
  admin: ['admin'],
  manager: ['manager'],
  subdistrict_leader: ['subdistrict_leader'],
  unit_leaders: ['unit_leader', 'assistantunit_leader'],
  lg_leaders: ['lg_leader', 'assistantlg_leader'],
};

const DraftMessageModal = ({
  draft = null,
  onClose,
  onSaved,
  onSent,
}) => {
  const isEdit = Boolean(draft);

  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');

  const [recipientOptions, setRecipientOptions] = useState({
    subdistricts: [],
    units: [],
    lifeGroups: [],
  });

  const [recipientMode, setRecipientMode] = useState('all');
  const [selectedLeadershipLevels, setSelectedLeadershipLevels] = useState([]);
  const [selectedScopes, setSelectedScopes] = useState([]);
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [recipientKeyword, setRecipientKeyword] = useState('');
  const [recipientResults, setRecipientResults] = useState([]);

  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [attachments, setAttachments] = useState([]);

  const scopePickerRef = useRef(null);
  const contentRef = useRef(null);
  const attachmentInputRef = useRef(null);

  /*
   * Populate existing draft
   */
  useEffect(() => {
    if (!draft) {
      setSubject('');
      setContent('');
      setAttachments([]);
      setRecipientMode('all');
      setSelectedLeadershipLevels([]);
      setSelectedScopes([]);
      setSelectedRecipients([]);

      if (contentRef.current) {
        contentRef.current.innerHTML = '';
      }

      return;
    }

    setSubject(draft.Subject ?? '');

    const savedContent =
      draft.Message ??
      draft.message ??
      draft.Content ??
      draft.Body ??
      '';

    const editorContent = savedContentToHtml(savedContent);

    setContent(editorContent);

    if (contentRef.current) {
      contentRef.current.innerHTML = editorContent;
    }

    setSelectedLeadershipLevels([]);

    if (Array.isArray(draft.Recipients)) {
      setRecipientMode('people');
      setSelectedScopes([]);
      setSelectedRecipients(draft.Recipients);
      return;
    }

    const scope = String(draft.RecipientScope ?? '');

    const leadershipSelections = scope.match(/^Leadership:\s*(.+)$/);

    if (leadershipSelections) {
      const labels = leadershipSelections[1]
        .split(',')
        .map((label) => label.trim());
      const values = LEADERSHIP_LEVELS
        .filter((level) => labels.includes(level.label))
        .map((level) => level.value);

      setRecipientMode('leadership');
      setSelectedLeadershipLevels(values);
      setSelectedScopes([]);
      setSelectedRecipients([]);
      return;
    }

    /*
     * Restore Subdistrict / Unit / Life Group draft
     */
    const scopeMatch = scope.match(
      /^(Subdistrict|Unit|Life Group)\s+(.+)$/
    );

    if (scopeMatch) {
      const mode = {
        Subdistrict: 'subdistrict',
        Unit: 'unit',
        'Life Group': 'group',
      }[scopeMatch[1]];

      const scopeIds = scopeMatch[2]
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

      setRecipientMode(mode);
      setSelectedScopes(scopeIds);
      setSelectedRecipients([]);
      return;
    }

    if (Array.isArray(draft.recipientGroups)) {
      setRecipientMode('group');
      setSelectedScopes(
        draft.recipientGroups.map((group) =>
          String(group.LifeGroupID ?? group.id ?? group.ID)
        )
      );
      setSelectedRecipients([]);
      return;
    }
    
    setRecipientMode(scope === 'All Members' ? 'all' : 'people');
    setSelectedScopes([]);
    setSelectedRecipients([]);
  }, [draft]);

  /*
   * Load recipient options
   */
  useEffect(() => {
    let cancelled = false;

    const loadRecipients = async () => {
      setLoadingRecipients(true);

      try {
        const res = await communicationService.getRecipientOptions();

        if (!cancelled) {
          setRecipientOptions(res.data ?? {});
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ??
            'Unable to load recipient options.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingRecipients(false);
        }
      }
    };

    loadRecipients();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Search recipients
   */
  useEffect(() => {
    const keyword = recipientKeyword.trim();

    if (!keyword) {
      setRecipientResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await communicationService.searchRecipients(keyword);
        setRecipientResults(res.data.recipients ?? []);
      } catch {
        setRecipientResults([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [recipientKeyword]);

  /*
   * Close scope dropdown when clicking outside
   */
  useEffect(() => {
    if (!scopeMenuOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (!scopePickerRef.current?.contains(event.target)) {
        setScopeMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);

    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [scopeMenuOpen]);

  const handleAddRecipient = (recipient) => {
    if (!recipient) return;

    const recipientId =
      recipient.id ??
      recipient.ID ??
      recipient.MemberID ??
      recipient.LifeGroupID ??
      recipient.UnitID ??
      recipient.SubdistrictID;

    const alreadySelected = selectedRecipients.some((item) => {
      const itemId =
        item.id ??
        item.ID ??
        item.MemberID ??
        item.LifeGroupID ??
        item.UnitID ??
        item.SubdistrictID;

      return String(itemId) === String(recipientId);
    });

    if (alreadySelected) {
      setRecipientKeyword('');
      setRecipientResults([]);
      return;
    }

    setSelectedRecipients((prev) => [...prev, recipient]);
    setRecipientKeyword('');
    setRecipientResults([]);
    setError('');
  };

  const handleRemoveRecipient = (recipient) => {
    const recipientId =
      recipient.id ??
      recipient.ID ??
      recipient.MemberID ??
      recipient.LifeGroupID ??
      recipient.UnitID ??
      recipient.SubdistrictID;

    setSelectedRecipients((prev) =>
      prev.filter((item) => {
        const itemId =
          item.id ??
          item.ID ??
          item.MemberID ??
          item.LifeGroupID ??
          item.UnitID ??
          item.SubdistrictID;

        return String(itemId) !== String(recipientId);
      })
    );
  };

  const getRecipientLabel = (recipient) => {
    const fullName = [
      recipient.FirstName,
      recipient.LastName,
    ].filter(Boolean).join(' ');

    const fallbackLabel =
      fullName ||
      recipient.LifeGroupName ||
      recipient.UnitName ||
      recipient.SubdistrictName ||
      recipient.Email ||
      'Recipient';

    return (
      recipient.label ??
      recipient.name ??
      recipient.Name ??
      recipient.MemberName ??
      fallbackLabel
    );
  };

  const getRecipientEmail = (recipient) =>
    recipient.Email ?? recipient.email ?? '';

  const buildPayload = () => {
    const scopeIds = selectedScopes.map(Number);

    return {
      subject: subject.trim(),
      message: content.trim(),
      recipientType: recipientMode === 'people' ? 'members' : recipientMode,
      memberIds: recipientMode === 'people'
        ? selectedRecipients.map(
            (recipient) =>
              recipient.MemberID ??
              recipient.id ??
              recipient.ID
          )
        : [],
      subdistrictId: recipientMode === 'subdistrict' ? scopeIds : null,
      unitId: recipientMode === 'unit' ? scopeIds : null,
      lifeGroupId: recipientMode === 'group' ? scopeIds : null,
      leadershipLevel: null,
      leadershipLevels: recipientMode === 'leadership'
        ? selectedLeadershipLevels.flatMap(
            (level) => LEADERSHIP_ROLE_VALUES[level] ?? []
          )
        : [],
    };
  };

  const validate = () => {
    if (recipientMode === 'people' && selectedRecipients.length === 0) {
      setError('Please select at least one person.');
      return false;
    }

    if (recipientMode === 'leadership' && selectedLeadershipLevels.length === 0) {
      setError('Please select at least one leadership level.');
      return false;
    }

    if (
      recipientMode !== 'all' &&
      recipientMode !== 'people' &&
      recipientMode !== 'leadership' &&
      selectedScopes.length === 0
    ) {
      setError('Please select a recipient group.');
      return false;
    }

    if (!subject.trim()) {
      setError('Subject is required.');
      return false;
    }

    if (!content.trim()) {
      setError('Message content is required.');
      return false;
    }

    return true;
  };

  const handleSaveDraft = async () => {
    setError('');

    if (!validate()) return;

    setSaving(true);

    try {
      const payload = buildPayload();

      if (isEdit) {
        await communicationService.updateDraft(
          draft.EmailID ?? draft.CommunicationID ?? draft.id,
          payload
        );
      } else {
        await communicationService.createDraft(payload);
      }

      if (onSaved) await onSaved();

      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ??
        'Unable to save the draft. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    setShowSendConfirm(false);
    setError('');
    setSending(true);

    try {
      const payload = buildPayload();

      await communicationService.sendEmail({
        ...payload,
        emailId: isEdit
          ? draft.EmailID ?? draft.CommunicationID ?? draft.id
          : null,
        attachments,
      });

      if (onSent) await onSent();

      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ??
        'Unable to send the email. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleDiscard = async () => {
    setShowDiscardConfirm(false);

    if (!isEdit) {
      onClose();
      return;
    }

    try {
      await communicationService.discardDraft(
        draft.EmailID ?? draft.CommunicationID ?? draft.id
      );

      if (onSaved) await onSaved();

      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ??
        'Unable to discard the draft. Please try again.'
      );
    }
  };

  const handleRecipientKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();

      if (recipientResults.length > 0) {
        handleAddRecipient(recipientResults[0]);
      }
    }

    if (event.key === 'Escape') {
      setRecipientKeyword('');
      setRecipientResults([]);
    }
  };

  const runEditorCommand = (command, value = null) => {
    contentRef.current?.focus();
    document.execCommand(command, false, value);
    setContent(contentRef.current?.innerHTML ?? '');
    setError('');
  };

  const handleEditorInput = (event) => {
    setContent(event.currentTarget.innerHTML);
    setError('');
  };


  const handleAttachmentChange = (event) => {
    const files = Array.from(event.target.files ?? []);

    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
              const [, base64Content = ''] =
                String(reader.result).split(',');

              resolve({
                filename: file.name,
                contentType: file.type || 'application/octet-stream',
                base64Content,
              });
            };

            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
      )
    )
      .then((newAttachments) => {
        setAttachments((current) => [
          ...current,
          ...newAttachments,
        ]);
        event.target.value = '';
      })
      .catch(() => {
        setError('Unable to read the selected attachment.');
      });
  };

  const removeAttachment = (filename) => {
    setAttachments((current) =>
      current.filter(
        (attachment) => attachment.filename !== filename
      )
    );
  };

  const handleRecipientModeChange = (mode) => {
    setRecipientMode(mode);
    setSelectedLeadershipLevels([]);
    setSelectedScopes([]);
    setScopeMenuOpen(false);
    setSelectedRecipients([]);
    setRecipientKeyword('');
    setRecipientResults([]);
    setError('');
  };

  const scopeOptions = {
    subdistrict: recipientOptions.subdistricts,
    unit: recipientOptions.units,
    group: recipientOptions.lifeGroups,
  }[recipientMode] ?? [];

  const getScopeId = (option) => {
    if (recipientMode === 'subdistrict') {
      return option.SubdistrictID;
    }

    if (recipientMode === 'unit') {
      return option.UnitID;
    }

    return option.LifeGroupID;
  };

  const getScopeLabel = (option) =>
    option.SubdistrictName ??
    option.UnitName ??
    option.LifeGroupName;

  const selectedScopeLabels = scopeOptions
    .filter((option) =>
      selectedScopes.includes(String(getScopeId(option)))
    )
    .map(getScopeLabel);

  const toggleScope = (scopeId) => {
    const stringId = String(scopeId);

    setSelectedScopes((current) =>
      current.includes(stringId)
        ? current.filter((id) => id !== stringId)
        : [...current, stringId]
    );

    setError('');
  };

  const toggleLeadershipLevel = (level) => {
    setSelectedLeadershipLevels((current) => {
      if (level === 'all') {
        return current.includes('all') ? [] : ['all'];
      }

      const withoutAll = current.filter((value) => value !== 'all');
      return withoutAll.includes(level)
        ? withoutAll.filter((value) => value !== level)
        : [...withoutAll, level];
    });
    setError('');
  };

  const getLeadershipConfirmLabel = () => {
    const labels = LEADERSHIP_LEVELS
      .filter((level) => selectedLeadershipLevels.includes(level.value))
      .map((level) => level.label);

    return labels.length > 0 ? labels.join(', ') : 'the selected leadership';
  };

  return (
    <>
      <div className="communication-modal-overlay" onClick={onClose}>
        <div
          className="communication-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="draft-message-title"
        >
          {/* Header */}
          <div className="communication-modal__header">
            <div className="communication-modal__header-left">
              <div className="communication-modal__header-icon">
                <span className="material-symbols-outlined">
                  edit_note
                </span>
              </div>

              <div>
                <h2
                  id="draft-message-title"
                  className="communication-modal__title"
                >
                  {isEdit ? 'Edit Draft' : 'Draft Message'}
                </h2>

                <p className="communication-modal__subtitle">
                  {isEdit
                    ? 'Update your email before sending.'
                    : 'Create a new email communication.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="communication-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Body */}
          <div className="communication-modal__body">
            {error && (
              <div className="communication-modal__error">
                {error}
              </div>
            )}

            {/* Recipients */}
            <div className="communication-form-field">
              <label className="communication-form-label">
                To:
              </label>

              <div
                className="communication-recipient-modes"
                role="tablist"
                aria-label="Recipient type"
              >
                {[
                  ['all', 'Everyone'],
                  ['leadership', 'Leadership'],
                  ['subdistrict', 'Subdistrict'],
                  ['unit', 'Unit'],
                  ['group', 'Life group'],
                  ['people', 'People'],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={recipientMode === mode}
                    className={`communication-recipient-mode${
                      recipientMode === mode
                        ? ' communication-recipient-mode--active'
                        : ''
                    }`}
                    onClick={() => handleRecipientModeChange(mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {recipientMode === 'people' ? (
                <>
                  <div className="communication-recipient-box">
                    {selectedRecipients.map((recipient, index) => (
                      <span
                        className="communication-recipient-chip"
                        key={recipient.MemberID ?? recipient.id ?? index}
                      >
                        <span>
                          {getRecipientLabel(recipient)}

                          {getRecipientEmail(recipient) && (
                            <small>
                              {getRecipientEmail(recipient)}
                            </small>
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveRecipient(recipient)
                          }
                          aria-label={`Remove ${getRecipientLabel(recipient)}`}
                        >
                          <span className="material-symbols-outlined">
                            close
                          </span>
                        </button>
                      </span>
                    ))}

                    <input
                      type="text"
                      value={recipientKeyword}
                      onChange={(e) =>
                        setRecipientKeyword(e.target.value)
                      }
                      onKeyDown={handleRecipientKeyDown}
                      placeholder="Type a person's name or email..."
                      className="communication-recipient-input"
                      autoComplete="off"
                    />
                  </div>

                  {recipientKeyword.trim() && (
                    <div className="communication-recipient-dropdown">
                      {loadingRecipients && (
                        <div className="communication-recipient-empty">
                          Loading people...
                        </div>
                      )}

                      {!loadingRecipients &&
                        recipientResults.length === 0 && (
                          <div className="communication-recipient-empty">
                            No people found.
                          </div>
                        )}

                      {!loadingRecipients &&
                        recipientResults.map((recipient, index) => (
                          <button
                            type="button"
                            className="communication-recipient-result"
                            key={
                              recipient.MemberID ??
                              recipient.id ??
                              index
                            }
                            onClick={() =>
                              handleAddRecipient(recipient)
                            }
                          >
                            <div className="communication-recipient-result__icon">
                              <span className="material-symbols-outlined">
                                person
                              </span>
                            </div>

                            <div className="communication-recipient-result__info">
                              <strong>
                                {getRecipientLabel(recipient)}
                              </strong>

                              {getRecipientEmail(recipient) && (
                                <span>
                                  {getRecipientEmail(recipient)}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </>
              ) : recipientMode === 'all' ? (
                <div className="communication-recipient-summary">
                  Everyone with an active account and valid email address
                </div>
              ) : recipientMode === 'leadership' ? (
                <div className="communication-leadership-selector">
                  <div
                    ref={scopePickerRef}
                    className="communication-recipient-scope-picker"
                  >
                    <button
                      type="button"
                      className={`communication-recipient-scope-trigger${
                        scopeMenuOpen
                          ? ' communication-recipient-scope-trigger--open'
                          : ''
                      }`}
                      onClick={() => setScopeMenuOpen((open) => !open)}
                      aria-expanded={scopeMenuOpen}
                    >
                      <span>
                        {selectedLeadershipLevels.length === 0
                          ? 'Choose leadership levels...'
                          : LEADERSHIP_LEVELS
                              .filter((level) => selectedLeadershipLevels.includes(level.value))
                              .map((level) => level.label)
                              .join(', ')}
                      </span>
                      <span className="material-symbols-outlined">
                        expand_more
                      </span>
                    </button>

                    {scopeMenuOpen && (
                      <div className="communication-recipient-scope-menu">
                        {LEADERSHIP_LEVELS.map((level) => {
                          const isSelected = selectedLeadershipLevels.includes(level.value);

                          return (
                            <button
                              key={level.value}
                              type="button"
                              className={`communication-recipient-scope${
                                isSelected
                                  ? ' communication-recipient-scope--selected'
                                  : ''
                              }`}
                              aria-pressed={isSelected}
                              onClick={() => toggleLeadershipLevel(level.value)}
                            >
                              <span className="communication-recipient-scope__check">
                                {isSelected && (
                                  <span className="material-symbols-outlined">
                                    check
                                  </span>
                                )}
                              </span>
                              <span>{level.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  ref={scopePickerRef}
                  className="communication-recipient-scope-picker"
                >
                  <button
                    type="button"
                    className={`communication-recipient-scope-trigger${
                      scopeMenuOpen
                        ? ' communication-recipient-scope-trigger--open'
                        : ''
                    }`}
                    onClick={() =>
                      setScopeMenuOpen((open) => !open)
                    }
                    aria-expanded={scopeMenuOpen}
                    disabled={loadingRecipients}
                  >
                    <span>
                      {loadingRecipients
                        ? 'Loading options...'
                        : selectedScopes.length === 0
                          ? `Choose ${
                              recipientMode === 'group'
                                ? 'life groups'
                                : `${recipientMode}s`
                            }...`
                          : selectedScopeLabels.join(', ')}
                    </span>

                    <span className="material-symbols-outlined">
                      expand_more
                    </span>
                  </button>

                  {scopeMenuOpen && !loadingRecipients && (
                    <div className="communication-recipient-scope-menu">
                      {scopeOptions.length === 0 && (
                        <div className="communication-recipient-empty">
                          No options found.
                        </div>
                      )}

                      {scopeOptions.map((option) => {
                        const scopeId = getScopeId(option);
                        const isSelected =
                          selectedScopes.includes(String(scopeId));

                        return (
                          <button
                            key={scopeId}
                            type="button"
                            className={`communication-recipient-scope${
                              isSelected
                                ? ' communication-recipient-scope--selected'
                                : ''
                            }`}
                            aria-pressed={isSelected}
                            onClick={() => toggleScope(scopeId)}
                          >
                            <span className="communication-recipient-scope__check">
                              {isSelected && (
                                <span className="material-symbols-outlined">
                                  check
                                </span>
                              )}
                            </span>

                            <span>
                              {getScopeLabel(option)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Subject */}
            <div className="communication-form-field">
              <label
                htmlFor="communication-subject"
                className="communication-form-label"
              >
                Subject:
              </label>

              <input
                id="communication-subject"
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setError('');
                }}
                className="communication-form-input"
                placeholder="Enter email subject..."
                maxLength={255}
              />
            </div>

            {/* Content */}
            <div className="communication-form-field communication-form-field--content">
              <label
                htmlFor="communication-content"
                className="communication-form-label"
              >
                Content:
              </label>

              <div className="communication-editor">
                <div className="communication-editor__toolbar">
                  <button
                    type="button"
                    title="Bold"
                    onClick={() => runEditorCommand('bold')}
                  >
                    <span className="material-symbols-outlined">
                      format_bold
                    </span>
                  </button>

                  <button
                    type="button"
                    title="Italic"
                    onClick={() => runEditorCommand('italic')}
                  >
                    <span className="material-symbols-outlined">
                      format_italic
                    </span>
                  </button>

                  <button
                    type="button"
                    title="Bulleted list"
                    onClick={() =>
                      runEditorCommand('insertUnorderedList')
                    }
                  >
                    <span className="material-symbols-outlined">
                      format_list_bulleted
                    </span>
                  </button>

                  <button
                    type="button"
                    title="Insert attachment"
                    onClick={() =>
                      attachmentInputRef.current?.click()
                    }
                  >
                    <span className="material-symbols-outlined">
                      attach_file
                    </span>
                  </button>

                  <input
                    ref={attachmentInputRef}
                    type="file"
                    hidden
                    multiple
                    onChange={handleAttachmentChange}
                  />
                </div>

                {attachments.length > 0 && (
                  <div className="communication-editor__attachments">
                    {attachments.map((attachment) => (
                      <span
                        className="communication-editor__attachment"
                        key={attachment.filename}
                      >
                        <span className="material-symbols-outlined">
                          attach_file
                        </span>

                        {attachment.filename}

                        <button
                          type="button"
                          onClick={() =>
                            removeAttachment(
                              attachment.filename
                            )
                          }
                          aria-label={`Remove ${attachment.filename}`}
                        >
                          <span className="material-symbols-outlined">
                            close
                          </span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div
                  id="communication-content"
                  ref={contentRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleEditorInput}
                  className="communication-editor__textarea"
                  data-placeholder="Write your message..."
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="communication-modal__footer">
            <button
              type="button"
              className="communication-btn communication-btn--discard btn btn--md btn--danger-ghost"
              onClick={() => setShowDiscardConfirm(true)}
              disabled={saving || sending}
            >
              <span className="material-symbols-outlined">
                delete
              </span>
              Discard Draft
            </button>

            <div className="communication-modal__footer-actions">
              <button
                type="button"
                className="communication-btn btn btn--md btn--ghost"
                onClick={handleSaveDraft}
                disabled={saving || sending}
              >
                {saving ? (
                  'Saving…'
                ) : (
                  <>
                    <span className="material-symbols-outlined">
                      save
                    </span>
                    {isEdit ? 'Update Draft' : 'Save Draft'}
                  </>
                )}
              </button>

              <button
                type="button"
                className="communication-btn btn btn--md btn--primary"
                onClick={() => {
                  setError('');

                  if (validate()) {
                    setShowSendConfirm(true);
                  }
                }}
                disabled={saving || sending}
              >
                {sending ? (
                  'Sending…'
                ) : (
                  <>
                    <span className="material-symbols-outlined">
                      send
                    </span>
                    Send Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDiscardConfirm && (
        <ConfirmDialog
          title="Discard Draft"
          message="Are you sure you want to discard this draft? This action cannot be undone."
          confirmLabel="Yes, Discard"
          cancelLabel="Cancel"
          onConfirm={handleDiscard}
          onCancel={() =>
            setShowDiscardConfirm(false)
          }
        />
      )}

      {showSendConfirm && (
        <ConfirmDialog
          title="Send Email"
          message={
            recipientMode === 'all'
              ? 'Are you sure you want to send this email to everyone with an active account and valid email address?'
              : recipientMode === 'people'
                ? `Are you sure you want to send this email to ${selectedRecipients.length} selected people?`
                : recipientMode === 'leadership'
                  ? `Are you sure you want to send this email to ${getLeadershipConfirmLabel()}?`
                  : `Are you sure you want to send this email to the selected ${
                      recipientMode === 'group'
                        ? 'life group'
                        : recipientMode
                    }?`
          }
          confirmLabel="Yes, Send"
          cancelLabel="Go Back"
          onConfirm={handleSend}
          onCancel={() =>
            setShowSendConfirm(false)
          }
        />
      )}
    </>
  );
};

export default DraftMessageModal;
