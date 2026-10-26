import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import communicationService from '../../services/communicationService';
import { canAccessCommunicationsPage, } from '../../permissions/communications';
import DraftMessageModal from '../../components/communications/DraftMessageModal';
import AnnouncementDetailModal from '../../components/communications/AnnouncementDetailModal';
import ConfirmDialog from '../../components/layout/ConfirmDialog';
import './Communication.css';

const CommunicationPage = () => {
  const { user } = useAuth();
  const role = user?.role;
  const location = useLocation();
  const navigate = useNavigate();

  const canAccess = canAccessCommunicationsPage(role);

  const [overview, setOverview] = useState({
    campaigns: [],
    drafts: [],
    stats: {
      activeSubscribers: 0,
      clickRate: 0,
    },
  });

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [showComposer, setShowComposer] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [draftToDelete, setDraftToDelete] = useState(null);
  const [activeView, setActiveView] = useState('announcements');

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get('action') === 'compose' && canAccess) {
      setSelectedDraft(null);
      setShowComposer(true);
      navigate('/communication', { replace: true });
    }
  }, [location.search, canAccess, navigate]);
  /*
   * Load communication overview
   */
  const loadOverview = async () => {
    if (!canAccess) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchError('');

    try {
      const res = await communicationService.getOverview();

      const data = res.data.data ?? res.data ?? {};
      const campaigns =
        data.campaigns ??
        data.recentEmails?.emails ??
        data.recentEmails ??
        [];

      setOverview({
        campaigns,
        drafts: data.drafts ?? campaigns.filter(
          (campaign) =>
            String(campaign.Status ?? campaign.status).toLowerCase() ===
            'draft'
        ),
        stats: {
          activeSubscribers:
            data.stats?.activeSubscribers ??
            data.activeSubscribers ??
            0,

          clickRate:
            data.stats?.clickRate ??
            data.clickRate ??
            0,
        },
      });
    } catch (err) {
      setFetchError(
        err.response?.data?.message ??
        'Unable to load communication data.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [canAccess]);

  /*
   * Open new message composer
   */
  const handleNewMessage = () => {
    setSelectedDraft(null);
    setShowComposer(true);
  };

  /*
   * Open existing draft
   */
  const handleOpenCampaign = (campaign) => {
    if (!campaign) return;

    const isDraft =
      campaign.Status === 'Draft' ||
      campaign.status === 'Draft' ||
      campaign.IsDraft === true ||
      campaign.isDraft === true;

    if (!isDraft) {
      return;
    }

    setSelectedDraft(campaign);
    setShowComposer(true);
  };

  /*
   * Close composer
   */
  const handleCloseComposer = () => {
    setShowComposer(false);
    setSelectedDraft(null);
  };

  const handleOpenAnnouncement = (announcement) => {
    setSelectedAnnouncement(announcement);
  };

  /*
   * Refresh after saving/sending
   */
  const handleComposerSaved = async () => {
    await loadOverview();
  };

  const handleComposerSent = async () => {
    await loadOverview();
  };

  const handleDeleteDraft = async () => {
    const draft = draftToDelete;
    const emailId =
      draft.EmailID ??
      draft.CommunicationID ??
      draft.id;

    if (!emailId) {
      setDraftToDelete(null);
      return;
    }

    try {
      await communicationService.discardDraft(emailId);
      setDraftToDelete(null);
      await loadOverview();
    } catch (err) {
      setDraftToDelete(null);
      setFetchError(
        err.response?.data?.message ??
        'Unable to delete the draft.'
      );
    }
  };

  /*
   * Format campaign date/time
   */
  const formatCampaignTime = (campaign) => {
    const dateValue =
      campaign.SentAt ??
      campaign.sentAt ??
      campaign.CreatedAt ??
      campaign.createdAt ??
      campaign.UpdatedAt ??
      campaign.updatedAt;

    if (!dateValue) {
      return '';
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs >= 0 && diffMs < hour) {
      const minutes = Math.max(
        1,
        Math.floor(diffMs / minute)
      );

      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }

    if (diffMs >= 0 && diffMs < day) {
      const hours = Math.floor(diffMs / hour);

      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    if (
      diffMs >= 0 &&
      diffMs < 2 * day
    ) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  /*
   * Campaign helpers
   */
  const getCampaignTitle = (campaign) => {
    return (
      campaign.Subject ??
      campaign.subject ??
      campaign.Title ??
      campaign.title ??
      'Untitled Message'
    );
  };

  const getCampaignRecipientText = (campaign) => {
    const recipientCount =
      campaign.RecipientCount ??
      campaign.recipientCount ??
      campaign.TotalRecipients ??
      campaign.totalRecipients;

    if (
      recipientCount !== undefined &&
      recipientCount !== null
    ) {
      return `Sent to ${recipientCount} recipient${Number(recipientCount) === 1 ? '' : 's'}`;
    }

    if (Array.isArray(campaign.Recipients)) {
      const recipientNames = campaign.Recipients
        .map((recipient) => [
          recipient.FirstName,
          recipient.LastName,
        ].filter(Boolean).join(' '))
        .filter(Boolean);

      if (recipientNames.length > 0) {
        return `Sent to ${recipientNames.join(', ')}`;
      }
    }

    return (
      campaign.RecipientSummary ??
      campaign.recipientSummary ??
      campaign.RecipientsLabel ??
      campaign.recipientsLabel ??
      campaign.RecipientScope ??
      campaign.recipientScope ??
      'Recipients not available'
    );
  };

  const getCampaignOpenRate = (campaign) => {
    const value =
      campaign.OpenRate ??
      campaign.openRate;

    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return null;
    }

    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
      return value;
    }

    return `${numericValue}%`;
  };

  const getCampaignIcon = (campaign) => {
    const type =
      campaign.Type ??
      campaign.type ??
      campaign.Category ??
      campaign.category ??
      '';

    if (
      String(type).toLowerCase().includes('event')
    ) {
      return 'event';
    }

    if (
      String(type).toLowerCase().includes('volunteer')
    ) {
      return 'volunteer_activism';
    }

    return 'campaign';
  };

  const getCampaignStatus = (campaign) => {
    return (
      campaign.Status ??
      campaign.status ??
      ''
    );
  };

  const draftCampaigns = overview.drafts;

  /*
   * Access denied
   */
  if (!canAccess) {
    return (
      <div className="communication-page">
        <div className="communication-page__access-denied">
          <div className="communication-page__access-icon">
            <span className="material-symbols-outlined">
              lock
            </span>
          </div>

          <h1>Communication Access Restricted</h1>

          <p>
            You do not have permission to access the
            Communication Hub.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="communication-page">

      {/* Page Header */}
      <div className="communication-page__header">
        <div>
          <h1 className="communication-page__title">
            Communication Hub
          </h1>

          <p className="communication-page__subtitle">
            Manage your congregation&apos;s digital
            outreach and connections.
          </p>
        </div>

        <button
          type="button"
          className="communication-page__new-button btn btn--primary btn--md"
          onClick={handleNewMessage}
        >
          <span className="material-symbols-outlined">
            add
          </span>

          New Message
        </button>
      </div>

      <div className="communication-page__view-switcher" role="tablist" aria-label="Communication view">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'announcements'}
          className={activeView === 'announcements' ? 'communication-page__view-button communication-page__view-button--active' : 'communication-page__view-button'}
          onClick={() => setActiveView('announcements')}
        >
          <span className="material-symbols-outlined">campaign</span>
          Recent Announcements
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'drafts'}
          className={activeView === 'drafts' ? 'communication-page__view-button communication-page__view-button--active' : 'communication-page__view-button'}
          onClick={() => setActiveView('drafts')}
        >
          <span className="material-symbols-outlined">edit_note</span>
          Draft Messages
        </button>
      </div>

      {/* Error */}
      {fetchError && (
        <div className="communication-page__error">
          <span className="material-symbols-outlined">
            error
          </span>

          <span>{fetchError}</span>

          <button
            type="button"
            onClick={loadOverview}
            aria-label="Retry"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Bento Grid */}
      <div className={`communication-page__grid communication-page__grid--${activeView}`}>

        {/* Recent Announcements */}
        {activeView === 'announcements' && (
        <section className="communication-card communication-card--campaigns">
          <div className="communication-card__header">
            <div>
              <h2 className="communication-card__title">
                Recent Announcements
              </h2>
            </div>

            <span className="material-symbols-outlined communication-card__header-icon">
              campaign
            </span>
          </div>

          {loading ? (
            <div className="communication-loading">
              <span className="material-symbols-outlined">
                progress_activity
              </span>

              Loading campaigns...
            </div>
          ) : overview.campaigns.filter(
            (campaign) =>
              String(getCampaignStatus(campaign)).toLowerCase() !==
              'draft'
          ).length === 0 ? (
            <div className="communication-empty">
              <div className="communication-empty__icon">
                <span className="material-symbols-outlined">
                  mail
                </span>
              </div>

              <h3>No campaigns yet</h3>

              <p>
                Create your first message to start
                communicating with your congregation.
              </p>

              <button
                type="button"
                className="btn btn--primary btn--md"
                onClick={handleNewMessage}
              >
                <span className="material-symbols-outlined">
                  add
                </span>

                New Message
              </button>
            </div>
          ) : (
            <div className="communication-campaign-list">
              {overview.campaigns.filter(
                (campaign) =>
                  String(getCampaignStatus(campaign)).toLowerCase() !==
                  'draft'
              ).map((campaign, index) => {
                const status = getCampaignStatus(campaign);
                const openRate =
                  getCampaignOpenRate(campaign);

                const isDraft =
                  String(status).toLowerCase() ===
                  'draft';

                return (
                  <div
                    className={`communication-campaign${
                      isDraft
                        ? ' communication-campaign--draft'
                        : ''
                    }`}
                    role="button"
                    tabIndex="0"
                    onClick={() => handleOpenAnnouncement(campaign)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleOpenAnnouncement(campaign);
                      }
                    }}
                    key={
                      campaign.EmailID ??
                      campaign.CommunicationID ??
                      campaign.id ??
                      index
                    }
                  >
                    <div className="communication-campaign__left">
                      <div className="communication-campaign__icon">
                        <span className="material-symbols-outlined">
                          {isDraft
                            ? 'edit_note'
                            : getCampaignIcon(campaign)}
                        </span>
                      </div>

                      <div className="communication-campaign__info">
                        <p className="communication-campaign__title">
                          {getCampaignTitle(campaign)}
                        </p>

                        <p className="communication-campaign__recipients">
                          {isDraft
                            ? 'Draft message'
                            : getCampaignRecipientText(
                                campaign
                              )}
                        </p>
                      </div>
                    </div>

                    <div className="communication-campaign__right">
                      {['sent', 'failed'].includes(String(status).toLowerCase()) && (
                        <span
                          className={`communication-campaign__status communication-campaign__status--${String(status).toLowerCase()}`}
                          title={String(status).toLowerCase() === 'sent'
                            ? 'Accepted by the email provider. Inbox delivery is not confirmed.'
                            : 'The send attempt failed. See the error for details.'}
                        >
                          {String(status).toLowerCase() === 'sent' ? 'Successfully sent' : 'Failed to send'}
                        </span>
                      )}
                      {openRate && !isDraft && (
                        <p className="communication-campaign__rate">
                          {openRate} Open Rate
                        </p>
                      )}

                      {isDraft && (
                        <button
                          type="button"
                          className="communication-campaign__edit"
                          onClick={() =>
                            handleOpenCampaign(
                              campaign
                            )
                          }
                        >
                          <span className="material-symbols-outlined">
                            edit
                          </span>

                          Edit
                        </button>
                      )}

                      <p className="communication-campaign__time">
                        {formatCampaignTime(campaign)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {/* Right Column */}
        {activeView === 'drafts' && (
        <aside className="communication-page__side communication-page__side--drafts">

          {/* Draft Messages */}
          <section className="communication-card communication-card--drafts">
            <div className="communication-card__header">
              <div>
                <h2 className="communication-card__title">
                  Draft Messages
                </h2>
              </div>

              <span className="material-symbols-outlined communication-card__header-icon">
                edit_note
              </span>
            </div>

            {loading ? (
              <div className="communication-drafts-loading">
                Loading drafts...
              </div>
            ) : draftCampaigns.length === 0 ? (
              <div className="communication-drafts-empty">
                <span className="material-symbols-outlined">
                  draft
                </span>

                <p>No draft messages yet.</p>

                <button
                  type="button"
                  className="btn btn--primary btn--md"
                  onClick={handleNewMessage}
                >
                  <span className="material-symbols-outlined">
                    add
                  </span>
                  Create Draft
                </button>
              </div>
            ) : (
              <div className="communication-drafts-list">
                {draftCampaigns.map((draft, index) => (
                  <div
                    className="communication-draft-item"
                    key={
                      draft.EmailID ??
                      draft.CommunicationID ??
                      draft.id ??
                      index
                    }
                  >
                    <button
                      type="button"
                      className="communication-draft-item__open"
                      onClick={() => handleOpenCampaign(draft)}
                      aria-label={`Edit ${getCampaignTitle(draft)}`}
                    >
                      <span className="communication-draft-item__icon">
                      <span className="material-symbols-outlined">
                        edit_note
                      </span>
                      </span>

                      <span className="communication-draft-item__content">
                      <strong>
                        {getCampaignTitle(draft)}
                      </strong>
                      <span>
                        {formatCampaignTime(draft) || 'Not saved yet'}
                      </span>
                      </span>

                    </button>

                    <button
                      type="button"
                      className="communication-draft-item__delete"
                      onClick={() => setDraftToDelete(draft)}
                      aria-label={`Delete ${getCampaignTitle(draft)}`}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

        </aside>
        )}
      </div>

      {/* Composer Modal */}
      {showComposer && (
        <DraftMessageModal
          draft={selectedDraft}
          onClose={handleCloseComposer}
          onSaved={handleComposerSaved}
          onSent={handleComposerSent}
        />
      )}

      <AnnouncementDetailModal
        announcement={selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
      />

      {draftToDelete && (
        <ConfirmDialog
          title="Delete Draft"
          message={`Are you sure to delete “${getCampaignTitle(draftToDelete)}”? This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          cancelLabel="Cancel"
          onConfirm={handleDeleteDraft}
          onCancel={() => setDraftToDelete(null)}
        />
      )}
    </div>
  );
};

export default CommunicationPage;
