import { useEffect, useRef, useState } from 'react';
import inactiveMemberService from '../../services/inactiveMemberService';
import './InactiveMemberModal.css';

const INACTIVE_REASONS = [
  'Transferred University',
  'Moved',
  'Changed Church',
  'Migrant',
  'Personal',
  'Others',
];

const DeactivateMemberModal = ({ member = null, editMode = false, onClose, onSuccess }) => {
  const [keyword, setKeyword] = useState('');
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(member);

  const [reason, setReason] = useState(editMode ? member?.InactiveReason ?? '' : '');
  const [notes, setNotes] = useState(editMode ? member?.InactiveNotes ?? '' : '');

  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [reasonError, setReasonError] = useState('');

  const searchTimeoutRef = useRef(null);

  /* Search members */
  useEffect(() => {
    if (selectedMember) {
      return;
    }

    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) {
      setMembers([]);
      setError('');
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setLoadingMembers(true);
        setError('');

        const response =
          await inactiveMemberService.searchMembersForDeactivate(
            trimmedKeyword
          );

        const payload = response.data?.data ?? response.data ?? [];
        const memberList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.members)
            ? payload.members
            : [];

        setMembers(memberList);
      } catch (err) {
        setMembers([]);

        setError(
          err.response?.data?.message ||
          'Failed to search members.'
        );
      } finally {
        setLoadingMembers(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [keyword, selectedMember]);

  /* Select member */
  const handleSelectMember = (member) => {
    setSelectedMember(member);
    setKeyword(`${member.FirstName} ${member.LastName}`);
    setMembers([]);
    setError('');
  };

  /* Change selected member */
  const handleChangeMember = () => {
    setSelectedMember(null);
    setKeyword('');
    setReason('');
    setNotes('');
    setError('');
    setReasonError('');
  };

  /* Reason change */
  const handleReasonChange = (e) => {
    setReason(e.target.value);
    setReasonError('');
    setError('');
  };

  /* Submit */
  const handleSubmit = async (e) => {
    e.preventDefault();

    let hasError = false;

    if (!selectedMember) {
      setError('Please select a member.');
      hasError = true;
    }

    if (!reason) {
      setReasonError('Deactivate reason is required.');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setReasonError('');

      const save = editMode ? inactiveMemberService.updateInactiveDetails : inactiveMemberService.deactivateMember;
      await save(
        selectedMember.MemberID,
        {
          reason,
          notes: notes.trim() || null,
        }
      );

      if (onSuccess) {
        onSuccess({ reason, notes: notes.trim() || null });
      }

      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        (editMode ? 'Failed to update inactive details.' : 'Failed to deactivate member.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* Avatar initials */
  const getInitials = (member) => {
    if (!member) {
      return '';
    }

    const first =
      member.FirstName?.charAt(0) || '';

    const last =
      member.LastName?.charAt(0) || '';

    return `${first}${last}`.toUpperCase();
  };

  /* Close on overlay click */
  const handleOverlayClick = (e) => {
    if (
      e.target === e.currentTarget &&
      !submitting
    ) {
      onClose();
    }
  };

  return (
    <div
      className="inactive-member-modal-overlay"
      onClick={handleOverlayClick}
    >
      <div
        className="inactive-member-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deactivate-member-title"
      >
        {/* Header */}
        <div className="inactive-member-modal__header">
          <div className="inactive-member-modal__heading">
            <h2
              id="deactivate-member-title"
              className="inactive-member-modal__title"
            >
              {editMode ? 'Edit Inactive Details' : 'Deactivate Member'}
            </h2>

            <p className="inactive-member-modal__subtitle">
              {editMode ? 'Update the reason and additional notes for this inactive member.' : member
                ? 'Record the reason this member is becoming inactive.'
                : 'Select a member and record the reason they are becoming inactive.'}
            </p>
          </div>

          <button
            type="button"
            className="inactive-member-modal__close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="inactive-member-modal__body">
            {/* Member Search */}
            <div className="inactive-member-modal__field">
              <label
                htmlFor="deactivate-member-search"
                className="inactive-member-modal__label"
              >
                Member
              </label>

              {!selectedMember && (
                <div className="inactive-member-modal__search-wrapper">
                  <input
                    id="deactivate-member-search"
                    type="text"
                    value={keyword}
                    onChange={(e) => {
                      setKeyword(e.target.value);
                      setError('');
                    }}
                    placeholder="Type member name..."
                    className="inactive-member-modal__search"
                    autoFocus
                    disabled={submitting}
                  />

                  {(loadingMembers ||
                    members.length > 0 ||
                    keyword.trim()) && (
                    <div className="inactive-member-modal__dropdown">
                      {loadingMembers && (
                        <div className="inactive-member-modal__dropdown-empty">
                          Searching members...
                        </div>
                      )}

                      {!loadingMembers &&
                        members.map((member) => (
                          <button
                            key={member.MemberID}
                            type="button"
                            className="inactive-member-modal__dropdown-item"
                            onClick={() =>
                              handleSelectMember(member)
                            }
                          >
                            <div className="inactive-member-modal__dropdown-avatar">
                              {getInitials(member)}
                            </div>

                            <div className="inactive-member-modal__dropdown-info">
                              <span className="inactive-member-modal__dropdown-name">
                                {member.FirstName}{' '}
                                {member.LastName}
                              </span>

                              {member.Email && (
                                <span className="inactive-member-modal__dropdown-email">
                                  {member.Email}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}

                      {!loadingMembers &&
                        keyword.trim() &&
                        members.length === 0 && (
                          <div className="inactive-member-modal__dropdown-empty">
                            No members found under your management.
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}

              {/* Selected Member */}
              {selectedMember && (
                <div className="inactive-member-modal__selected">
                  <div className="inactive-member-modal__selected-header">
                    <div className="inactive-member-modal__selected-avatar">
                      {getInitials(selectedMember)}
                    </div>

                    <div>
                      <p className="inactive-member-modal__selected-name">
                        {selectedMember.FirstName}{' '}
                        {selectedMember.LastName}
                      </p>

                      {selectedMember.Email && (
                        <p className="inactive-member-modal__selected-email">
                          {selectedMember.Email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Hierarchy */}
                  <div className="inactive-member-modal__hierarchy">
                    <div className="inactive-member-modal__hierarchy-item">
                      <span className="inactive-member-modal__hierarchy-label">
                        Subdistrict
                      </span>

                      <span className="inactive-member-modal__hierarchy-value">
                        {selectedMember.SubdistrictName || '—'}
                      </span>
                    </div>

                    <div className="inactive-member-modal__hierarchy-item">
                      <span className="inactive-member-modal__hierarchy-label">
                        Unit
                      </span>

                      <span className="inactive-member-modal__hierarchy-value">
                        {selectedMember.UnitName || '—'}
                      </span>
                    </div>

                    <div className="inactive-member-modal__hierarchy-item">
                      <span className="inactive-member-modal__hierarchy-label">
                        Life Group
                      </span>

                      <span className="inactive-member-modal__hierarchy-value">
                        {selectedMember.LifeGroupName || '—'}
                      </span>
                    </div>
                  </div>

                  {!member && (
                    <button
                      type="button"
                      className="inactive-member-modal__change btn btn--ghost btn--sm"
                      onClick={handleChangeMember}
                      disabled={submitting}
                    >
                      Change Member
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Deactivate Reason */}
            <div className="inactive-member-modal__field">
              <label
                htmlFor="inactive-reason"
                className="inactive-member-modal__label"
              >
                Deactivate Reason
              </label>

              <select
                id="inactive-reason"
                value={reason}
                onChange={handleReasonChange}
                className="inactive-member-modal__select"
                disabled={submitting}
              >
                <option value="">
                  Select deactivate reason
                </option>

                {INACTIVE_REASONS.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>

              {reasonError && (
                <span className="inactive-member-modal__field-error">
                  {reasonError}
                </span>
              )}
            </div>

            {/* Additional Notes */}
            <div className="inactive-member-modal__field">
              <label
                htmlFor="inactive-notes"
                className="inactive-member-modal__label"
              >
                Additional Notes
              </label>

              <textarea
                id="inactive-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional information..."
                className="inactive-member-modal__textarea"
                disabled={submitting}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="inactive-member-modal__error">
                {error}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="inactive-member-modal__actions">
            <button
              type="button"
              className="inactive-member-modal__button btn btn--md btn--ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="inactive-member-modal__button btn btn--md btn--primary"
              disabled={
                submitting ||
                !selectedMember ||
                !reason
              }
            >
              {submitting
                ? (editMode ? 'Saving...' : 'Deactivating...')
                : (editMode ? 'Save Changes' : 'Deactivate Member')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeactivateMemberModal;
