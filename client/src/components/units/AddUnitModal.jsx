import { useState, useEffect } from 'react';
import unitService from '../../services/unitService';
import memberService from '../../services/memberService';
import './UnitModal.css';

const AddUnitModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState({
    unitName: '',
    subdistrictId: '',
    leaderMemberId: '',
  });

  const [subdistricts, setSubdistricts] = useState([]);
  const [members, setMembers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      unitService.getSubdistricts().then(r => r.data?.data ?? []),
      memberService.getMembers({ limit: 200 }).then(r => r.data?.data?.members ?? [])
    ])
      .then(([subs, mems]) => {
        if (cancelled) return;
        setSubdistricts(subs);
        setMembers(mems);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
    setApiError(null);
  };

  const validate = () => {
    const e = {};
    if (!form.unitName.trim()) e.unitName = "Unit name is required";
    if (!form.subdistrictId) e.subdistrictId = "Subdistrict is required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    setSubmitting(true);
    setApiError(null);

    try {
      await unitService.createUnit({
        unitName: form.unitName.trim(),
        subdistrictId: Number(form.subdistrictId),
        leaderMemberId: form.leaderMemberId ? Number(form.leaderMemberId) : null
      });
      onSave();
    } catch (err) {
      setApiError(err.response?.data?.message ?? "Failed to create unit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="unit-modal-overlay">
      <div className="unit-modal">
        <div className="unit-modal__header">
          <div>
            <h2 className="unit-modal__title">Create New Unit</h2>
            <p className="unit-modal__subtitle">Create a church unit and assign its leader.</p>
          </div>
          <button className="unit-modal__close" onClick={onClose}>×</button>
        </div>

        <div className="unit-modal__body">
          {apiError && <p className="unit-modal__api-error">{apiError}</p>}

          <div className="unit-modal__field">
            <label className="unit-modal__label">Unit Name</label>
            <input
              name="unitName"
              value={form.unitName}
              onChange={handleChange}
              className="unit-modal__input"
              placeholder="e.g. North District Unit"
            />
            {errors.unitName && <span className="unit-modal__error">{errors.unitName}</span>}
          </div>

          <div className="unit-modal__field">
            <label className="unit-modal__label">Subdistrict</label>
            <select
              name="subdistrictId"
              value={form.subdistrictId}
              onChange={handleChange}
              className="unit-modal__select"
              disabled={loading}
            >
              <option value="">{loading ? 'Loading...' : 'Select subdistrict'}</option>
              {subdistricts.map(s => (
                <option key={s.SubdistrictID} value={s.SubdistrictID}>{s.SubdistrictName}</option>
              ))}
            </select>
            {errors.subdistrictId && <span className="unit-modal__error">{errors.subdistrictId}</span>}
          </div>

          <div className="unit-modal__field">
            <label className="unit-modal__label">Assigned Leader</label>
            <select
              name="leaderMemberId"
              value={form.leaderMemberId}
              onChange={handleChange}
              className="unit-modal__select"
              disabled={loading}
            >
              <option value="">Select leader (optional)</option>
              {members.map(m => (
                <option key={m.MemberID} value={m.MemberID}>{m.FirstName} {m.LastName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="unit-modal__actions">
          <button className="btn btn--ghost btn--md" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn btn--md btn--primary"
            onClick={handleSubmit}
            disabled={submitting || loading}
          >
            {submitting ? 'Creating...' : 'Create Unit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddUnitModal;