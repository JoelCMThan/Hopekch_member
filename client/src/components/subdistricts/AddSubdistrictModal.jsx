import { useState, useEffect } from 'react';
import '../members/Modal.css';
import './SubdistrictModal.css';
import subdistrictService from '../../services/subdistrictService';
import memberService from '../../services/memberService';

const AddSubdistrictModal = ({ onClose, onSave }) => {
  const [subdistrictName, setSubdistrictName] = useState('');
  const [leaderMemberId, setLeaderMemberId] = useState('');
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subdistrictName.trim()) {
      setError('Subdistrict name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await subdistrictService.createSubdistrict({
        subdistrictName: subdistrictName.trim(),
        leaderMemberId: leaderMemberId ? Number(leaderMemberId) : null,
      });

      onSave();
    } catch (err) {
      setError(
        err.response?.data?.message ??
        'Failed to create subdistrict'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <form className="subdistrict-modal" onSubmit={handleSubmit}>
        <div className="subdistrict-modal__header">
          <h2 className="subdistrict-modal__title">Create Subdistrict</h2>
        </div>

        <div className="subdistrict-modal__body">
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
              value={subdistrictName}
              onChange={(e) => setSubdistrictName(e.target.value)}
              placeholder="Enter subdistrict name"
              disabled={saving}
            />
          </div>

          <div className="subdistrict-modal__field">
            <label className="subdistrict-modal__label">
              Assigned Leader
            </label>
            <select
              className="subdistrict-modal__input"
              value={leaderMemberId}
              onChange={(e) => setLeaderMemberId(e.target.value)}
              disabled={saving || loadingMembers}
            >
              <option value="">{loadingMembers ? 'Loading leaders...' : 'Select leader (optional)'}</option>
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
            disabled={saving}
            className="btn btn--primary btn--md"
          >
            {saving ? 'Saving...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddSubdistrictModal;