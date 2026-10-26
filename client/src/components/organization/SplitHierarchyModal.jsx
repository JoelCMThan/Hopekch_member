import { useEffect, useState } from 'react';
import unitService from '../../services/unitService';
import subdistrictService from '../../services/subdistrictService';
import { getHierarchySplitReason } from '../../utils/groupSplit';
import '../groups/GroupModal.css';

const SplitHierarchyModal = ({ kind, source, onClose, onSplit }) => {
  const isUnit = kind === 'unit';
  const label = isUnit ? 'Unit' : 'Subdistrict';
  const childLabel = isUnit ? 'Groups' : 'Units';
  const sourceName = isUnit ? source.UnitName : source.SubdistrictName;
  const sourceId = isUnit ? source.UnitID : source.SubdistrictID;
  const service = isUnit ? unitService : subdistrictService;
  const [name, setName] = useState(`${sourceName} Branch`);
  const [children, setChildren] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [selected, setSelected] = useState([]);
  const [leaderId, setLeaderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadedSource, setLoadedSource] = useState(null);
  const splitReason = getHierarchySplitReason(loadedSource);
  const validSelection = selected.length > 0 && selected.every(id =>
    children.some(child =>
      child.id === id && Number(child.IsUsable) === 1
    )
  );

  useEffect(() => {
    let cancelled = false;

    service.getSplitOptions(sourceId)
      .then(response => {
        if (cancelled) return;

        setChildren(response.data.data.children);
        setLeaders(response.data.data.leaders);
        setLoadedSource(response.data.data.source);
      })
      .catch(err => {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
            'Could not load split options. Close and reopen to try again.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      })

    return () => {
      cancelled = true;
    };
  }, [service, sourceId]);

  const submit = async (event) => {
    event.preventDefault();

    if (loading || submitting || splitReason || !validSelection || !name.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      await service.split(sourceId, {
        name: name.trim(),
        childIds: selected,
        leaderMemberId: leaderId ? Number(leaderId) : null,
      });
    } catch (err) {
      setError(err.response?.data?.message || `Failed to split ${kind}`);
      setSubmitting(false);
      return;
    }

    onSplit();
  };

  return (
    <div
      className="group-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hierarchy-split-title"
    >
      <form className="group-modal group-modal--split" onSubmit={submit}>
        <div className="group-modal__header">
          <div>
            <h2 id="hierarchy-split-title" className="group-modal__title">
              Split {label}: {sourceName}
            </h2>
            <p className="group-modal__subtitle">
              Move selected {childLabel.toLowerCase()} into a new {kind}
              {isUnit ? ' in the same subdistrict' : ''}. The original {kind} is kept.
            </p>
          </div>

          <button
            type="button"
            className="group-modal__close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <div className="group-modal__body">
          {!loading && loadedSource && splitReason && (
            <p className="group-modal__api-error" role="status">
              {splitReason}
            </p>
          )}

          {error && (
            <p
              className="group-modal__api-error group-modal__hierarchy-error"
              role="alert"
            >
              {error}
            </p>
          )}

          <div>
            <span className="group-modal__label">
              {childLabel} ({children.length})
            </span>

            <div className="group-modal__member-list">
              {loading ? (
                <p>Loading...</p>
              ) : children.length === 0 ? (
                <p>No {childLabel.toLowerCase()} to move.</p>
              ) : (
                children.map(child => (
                  <label className="group-modal__member" key={child.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(child.id)}
                      disabled={
                        submitting ||
                        Boolean(splitReason) ||
                        Number(child.IsUsable) !== 1
                      }
                      onChange={() => setSelected(current =>
                        current.includes(child.id)
                          ? current.filter(id => id !== child.id)
                          : [...current, child.id]
                      )}
                    />
                    <span className="group-modal__member-meta">
                      <span className="group-modal__member-name">
                        {child.name}
                      </span>
                      {(splitReason || Number(child.IsUsable) !== 1) && (
                        <span className="group-modal__member-hint">
                          {Number(child.IsActive) !== 1
                            ? 'Inactive — cannot be included in split'
                            : `Unavailable — ${
                              child.UnusableReason ||
                              loadedSource?.UnusableReason ||
                              'hierarchy is not usable'
                            }`}
                        </span>
                      )}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="group-modal__field">
              <label
                className="group-modal__label"
                htmlFor="hierarchy-split-name"
              >
                New {label} Name
              </label>
              <input
                className="group-modal__input"
                id="hierarchy-split-name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                maxLength={255}
                disabled={submitting}
              />
            </div>

            <div className="group-modal__field">
              <label
                className="group-modal__label"
                htmlFor="hierarchy-split-leader"
              >
                New {label} Leader
              </label>
              <select
                className="group-modal__input"
                id="hierarchy-split-leader"
                value={leaderId}
                onChange={e => setLeaderId(e.target.value)}
                disabled={loading || submitting}
              >
                <option value="">Select leader (optional)</option>
                {leaders.map(leader => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="group-modal__summary" aria-live="polite">
              <div className="group-modal__summary-title">
                Impact Summary
              </div>
              <div className="group-modal__summary-row">
                <span>Moving</span>
                <span>{selected.length} {childLabel}</span>
              </div>
              <div className="group-modal__summary-row">
                <span>Remaining</span>
                <span>{children.length - selected.length} {childLabel}</span>
              </div>
              <p className="group-modal__member-hint">
                {isUnit
                  ? 'Members stay in their existing groups.'
                  : 'Groups and members stay in their existing units.'}
              </p>
            </div>
          </div>
        </div>

        <div className="group-modal__actions">
          <button
            type="button"
            className="btn btn--ghost btn--md"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--md btn--primary"
            disabled={
              loading ||
              submitting ||
              Boolean(splitReason) ||
              !validSelection ||
              !name.trim()
            }
          >
            {submitting ? 'Splitting...' : 'Confirm Split'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SplitHierarchyModal;
