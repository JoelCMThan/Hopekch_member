import { useState, useEffect, useRef } from 'react';
import groupService from '../../services/groupService';
import { getGroupSplitReason } from '../../utils/groupSplit';
import MeetingLocationPicker from './MeetingLocationPicker';
import './GroupModal.css';

const SplitGroupModal = ({ group, onClose, onSplit }) => {
  const [newGroupName,    setNewGroupName]    = useState(`${group?.LifeGroupName ?? ''} Branch`);
  const [meetingLocation, setMeetingLocation] = useState({
    groupAddress: '',
    latitude: null,
    longitude: null,
  });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [members,         setMembers]         = useState([]);
  const [loadingMembers,  setLoadingMembers]  = useState(true);
  const [submitting,      setSubmitting]      = useState(false);
  const [apiError,        setApiError]        = useState(null);
  const [loadedGroup, setLoadedGroup] = useState(null);

  // Leader search state
  const [leaderSearch,     setLeaderSearch]     = useState('');
  const [leaderMemberId,   setLeaderMemberId]   = useState(null);
  const [leaderName,       setLeaderName]       = useState('');
  const [showLeaderDrop,   setShowLeaderDrop]   = useState(false);
  const leaderInputRef = useRef(null);

  useEffect(() => {
    if (!group?.LifeGroupID) return;
    setLoadingMembers(true);
    groupService.getGroup(group.LifeGroupID)
      .then(r => {
        setLoadedGroup(r.data?.data ?? null);
        const m = r.data?.data?.members ?? [];
        setMembers(m);
        setSelectedMembers([]);
      })
      .catch(() => setApiError('Could not load group members'))
      .finally(() => setLoadingMembers(false));
  }, [group?.LifeGroupID]);

  if (!group) return null;
  const splitReason = getGroupSplitReason(loadedGroup);

  // Leader candidates filtered by search query
  const leaderCandidates = leaderSearch.trim()
    ? members.filter(m =>
        `${m.FirstName} ${m.LastName}`.toLowerCase().includes(leaderSearch.toLowerCase())
      )
    : members;

  const selectLeader = (m) => {
    setLeaderMemberId(m.MemberID);
    setLeaderName(`${m.FirstName} ${m.LastName}`);
    setLeaderSearch('');
    setShowLeaderDrop(false);
  };

  const clearLeader = () => {
    setLeaderMemberId(null);
    setLeaderName('');
    setLeaderSearch('');
  };

  const toggleMember = (id) => {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (loadingMembers || submitting || splitReason) return;
    setSubmitting(true);
    setApiError(null);
    try {
      await groupService.splitGroup(group.LifeGroupID, {
        newGroupName:   newGroupName.trim() || `${group.LifeGroupName} Split`,
        groupAddress:   meetingLocation.groupAddress.trim() || null,
        latitude:       meetingLocation.latitude,
        longitude:      meetingLocation.longitude,
        memberIds:      selectedMembers,
        leaderMemberId: leaderMemberId ?? null,
      });
      onSplit();
    } catch (err) {
      setApiError(err.response?.data?.message ?? 'Failed to split group');
    } finally {
      setSubmitting(false);
    }
  };

  const remainingCount = members.length - selectedMembers.length;

  return (
    <div className="group-modal-overlay" role="dialog" aria-modal="true">
      <div className="group-modal group-modal--split">
        <div className="group-modal__header">
          <div>
            <h2 className="group-modal__title">Split Group: {group.LifeGroupName}</h2>
            <p className="group-modal__subtitle">
              Move selected members into a new branch without losing the original group.
            </p>
          </div>
          <button className="group-modal__close" onClick={onClose} aria-label="Close modal">×</button>
        </div>

        {apiError && <p className="group-modal__api-error group-modal__split-error" >{apiError}</p>}

        {loadedGroup && splitReason && <p className="group-modal__api-error" role="status">{splitReason}</p>}
        <div className="group-modal__body">

          {/* Left — member checklist */}
          <div>
            <div className="group-modal__field group-modal__field--flush" >
              <span className="group-modal__label">
                {loadingMembers
                  ? 'Loading members…'
                  : `Selectable Members (${members.length})`}
              </span>
            </div>
            <div className="group-modal__member-list">
              {loadingMembers ? (
                <p className="group-modal__state">Loading…</p>
              ) : members.length === 0 ? (
                <p className="group-modal__state">No members in this group yet.</p>
              ) : (
                members.map((m) => (
                  <label key={m.MemberID} className="group-modal__member">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(m.MemberID)}
                      onChange={() => toggleMember(m.MemberID)}
                      disabled={submitting}
                    />
                    <div className="group-modal__member-meta">
                      <span className="group-modal__member-name">{m.FirstName} {m.LastName}</span>
                      <span className="group-modal__member-hint">{m.Email || m.Gender || 'Member'}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Right — new group settings */}
          <div>
            <div className="group-modal__field">
              <label className="group-modal__label" htmlFor="split-group-name">New Group Name</label>
              <input
                id="split-group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="group-modal__input"
                placeholder="Enter new group name"
                disabled={submitting}
              />
            </div>

            {/* Leader selection with search */}
            <div className="group-modal__field group-modal__leader-field" >
              <label className="group-modal__label">New Group Leader</label>

              {leaderMemberId ? (
                <div className="group-modal__leader-selection">
                  <span
                    className="group-modal__leader-name"
                  >
                    ✓ {leaderName}
                  </span>
                  <button
                    type="button"
                    onClick={clearLeader}
                    className="group-modal__leader-clear"
                    title="Clear selection"
                    disabled={submitting}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={leaderInputRef}
                    className="group-modal__input"
                    placeholder={loadingMembers ? 'Loading members…' : 'Type a name to search…'}
                    value={leaderSearch}
                    onChange={(e) => { setLeaderSearch(e.target.value); setShowLeaderDrop(true); }}
                    onFocus={() => setShowLeaderDrop(true)}
                    onBlur={() => setTimeout(() => setShowLeaderDrop(false), 150)}
                    disabled={submitting || loadingMembers}
                  />
                  {showLeaderDrop && leaderCandidates.length > 0 && (
                    <div className="group-modal__leader-dropdown">
                      {leaderCandidates.map(m => (
                        <button
                          key={m.MemberID}
                          type="button"
                          onMouseDown={() => selectLeader(m)}
                          className="group-modal__leader-option"
                        >
                          {m.FirstName} {m.LastName}
                          {m.Email && <span className="group-modal__leader-email">{m.Email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {showLeaderDrop && leaderSearch && leaderCandidates.length === 0 && (
                    <div className="group-modal__leader-empty">
                      No members match "{leaderSearch}"
                    </div>
                  )}
                </>
              )}
              <p className="group-modal__leader-helper">
                Optional — search by name from this group's members.
              </p>
            </div>

            <MeetingLocationPicker
              value={meetingLocation}
              disabled={submitting}
              onChange={(location) => {
                setMeetingLocation(location);
                setApiError(null);
              }}
            />

            <div className="group-modal__summary">
              <div className="group-modal__summary-title">Impact Summary</div>
              <div className="group-modal__summary-row">
                <span>Migrating</span>
                <span>{selectedMembers.length} Members</span>
              </div>
              <div className="group-modal__summary-row">
                <span>Remaining</span>
                <span>{remainingCount} Members</span>
              </div>
              {leaderMemberId && (
                <div className="group-modal__summary-row">
                  <span>New Leader</span>
                  <span>{leaderName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="group-modal__actions">
          <button type="button" className="btn btn--ghost btn--md" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--md btn--primary"
            onClick={handleSubmit}
            disabled={submitting || loadingMembers || Boolean(splitReason) || selectedMembers.length === 0}
          >
            {submitting ? 'Splitting…' : 'Confirm Split'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SplitGroupModal;
