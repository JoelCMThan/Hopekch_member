import { CloseIcon } from '../icons';
import './CommunicationModal.css';

const AnnouncementDetailModal = ({
  announcement,
  onClose,
}) => {
  if (!announcement) {
    return null;
  }

  const getTitle = () =>
    announcement.Subject ??
    announcement.subject ??
    announcement.Title ??
    announcement.title ??
    'Untitled Message';

  const getRecipientText = () => {
    const recipientCount =
      announcement.RecipientCount ??
      announcement.recipientCount ??
      announcement.TotalRecipients ??
      announcement.totalRecipients;

    if (recipientCount !== undefined && recipientCount !== null) {
      return `Sent to ${recipientCount} recipient${
        Number(recipientCount) === 1 ? '' : 's'
      }`;
    }

    return (
      announcement.RecipientSummary ??
      announcement.recipientSummary ??
      announcement.RecipientScope ??
      announcement.recipientScope ??
      announcement.RecipientsLabel ??
      announcement.recipientsLabel ??
      'Recipients not available'
    );
  };

  const sender =
    announcement.SenderName ??
    announcement.senderName ??
    'Unknown sender';

  const message =
    announcement.Message ??
    announcement.message ??
    announcement.Content ??
    announcement.content ??
    'No message content available.';

  return (
    <div
      className="communication-announcement-overlay"
      onClick={onClose}
    >
      <article
        className="communication-announcement-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <header className="communication-announcement-modal__header">
          {/* Sender + Recipients */}
          <div className="communication-announcement-modal__meta">
            <div>
              <span>Sender</span>
              <strong>{sender}</strong>
            </div>

            <div>
              <span>Recipients</span>
              <strong>{getRecipientText()}</strong>
            </div>
          </div>

          {/* Close */}
          <button
            type="button"
            className="communication-announcement-modal__close"
            onClick={onClose}
            aria-label="Close announcement"
          >
            <CloseIcon />
          </button>
        </header>

        {/* Content */}
        <div className="communication-announcement-modal__content">
          <h2 id="announcement-detail-title">
            {getTitle()}
          </h2>

          <div
            className="communication-announcement-modal__message"
            dangerouslySetInnerHTML={{ __html: message }}
          />
        </div>
      </article>
    </div>
  );
};

export default AnnouncementDetailModal;
