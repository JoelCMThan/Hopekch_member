import '../members/Modal.css';
import './ConfirmDialog.css';

const ConfirmDialog = ({
  title = 'Confirm',
  message = 'Are you sure to save these changes?',
  onConfirm,
  onCancel,
  confirmLabel = 'Save Changes',
  cancelLabel = 'Cancel',
  danger = false,
  pending = false,
}) => (
  <div className="modal-overlay confirm-dialog-overlay" onClick={pending ? undefined : onCancel}>
    <div
      className={`confirm-dialog${danger ? ' confirm-dialog--danger' : ''}`}
      onClick={(e) => e.stopPropagation()}
      role="alertdialog"
      aria-modal="true"
    >
      <div className="confirm-dialog__header">
        <h2 className="confirm-dialog__title">{title}</h2>
      </div>

      <div className="confirm-dialog__body">
        {message}
      </div>

      <div className="confirm-dialog__footer">
        <button
          type="button"
          className="btn btn--ghost btn--md"
          disabled={pending}
          onClick={onCancel}
        >
          {cancelLabel}
        </button>

        <button
          type="button"
          className={`btn btn--md ${danger ? 'btn--danger' : 'btn--primary'}`}
          disabled={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmDialog;