import { useState, useEffect } from 'react';
import '../members/Modal.css';
import './SubdistrictModal.css';
import subdistrictService from '../../services/subdistrictService';
import memberService from '../../services/memberService';

const EditSubdistrictModal = ({ subdistrict, onClose, onSave }) => {
  const [name, setName] = useState(subdistrict?.SubdistrictName ?? '');
  const [leaderMemberId, setLeaderMemberId] = useState('');
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(subdistrict?.SubdistrictName ?? '');
    setLeaderMemberId('');
  }, [subdistrict]);

  useEffect(() => {
    let cancelled = false;

    memberService.getMembers({ limit: 200 })
      .then((res) => {
        if (cancelled) return;
        setMembers(res.data?.data?.members ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingMembers(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!subdistrict) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Subdistrict name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await subdistrictService.updateSubdistrict(
        subdistrict.SubdistrictID,
        {
          subdistrictName: name.trim(),
          leaderMemberId: leaderMemberId ? Number(leaderMemberId) : null,
        }
      );

      onSave();
    } catch (err) {
      setError(
        err.response?.data?.message ??
        'Failed to update subdistrict'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <form className="subdistrict-modal" onSubmit={handleSubmit}>
        <div className="subdistrict-modal__header">
          <h2 className="subdistrict-modal__title">
            Edit Subdistrict
          </h2>
        </div>

        <div className="subdistrict-modal__body">
          <div className="organization-leaders">
            <p>Leaders: {subdistrict.LeaderNames || 'Unassigned'}</p>
            <p>Adding a leader keeps the current assignments. Manage individual roles in Member Management.</p>
          </div>
          {error && (
            <div className="subdistrict-modal__error">
              {error}
            </div>
          )}

          <div className="subdistrict-modal__field">
            <label className="subdistrict-modal__label">
              Subdistrict Name
            </label>
            <input
              className="subdistrict-modal__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="subdistrict-modal__field">
            <label className="subdistrict-modal__label">
              Add Leader
            </label>
            <select
              className="subdistrict-modal__input"
              value={leaderMemberId}
              onChange={(e) => setLeaderMemberId(e.target.value)}
              disabled={saving || loadingMembers}
            >
              <option value="">{loadingMembers ? 'Loading leaders...' : 'Keep current leaders'}</option>
              {members.map((member) => (
                <option key={member.MemberID} value={member.MemberID}>
                  {member.FirstName} {member.LastName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="subdistrict-modal__footer">
          <button
            type="button"
            className="btn btn--ghost btn--md"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="btn btn--primary btn--md"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditSubdistrictModal;