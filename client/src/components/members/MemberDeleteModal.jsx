/*
 * Confirmation dialog before deleting a member.
 * Only shown when user has permission (admin only).
 */

import { useState } from 'react';
import memberService from '../../services/memberService';
import './Modal.css';

import { CloseIcon, AlertIcon } from '../icons';

const MemberDeleteModal = ({ member, onClose, onConfirm }) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const fullName =
    `${member?.FirstName ?? ''} ${member?.LastName ?? ''}`.trim();

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      await memberService.deleteMember(member.MemberID);
      onConfirm();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Delete failed. Please try again.'
      );
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal--sm"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm delete member"
      >
        {/* Header */}
        <div className="modal__header">
          <h2 className="modal__title">Delete Member</h2>

          <button
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="modal__body">
          <div className="delete-modal__warning">
            <div className="delete-modal__icon">
              <AlertIcon />
            </div>

            <div className="delete-modal__text">
              <p className="delete-modal__headline">
                Delete <strong>{fullName}</strong>?
              </p>

              <p className="delete-modal__subtext">
                This will permanently remove the member and all related data.
                This action can’t be undone.
              </p>
            </div>
          </div>

          {error && (
            <div className="modal__error-banner">{error}</div>
          )}

          {/* Footer */}
          <div className="modal__footer">
            <button
              type="button"
              className="btn btn--ghost btn--md"
              onClick={onClose}
              disabled={deleting}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn btn--danger btn--md"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberDeleteModal;