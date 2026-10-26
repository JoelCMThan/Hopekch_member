import { useState } from 'react';
import analyticsService from '../../services/analyticsService';
import { CloseIcon } from '../icons';
import '../members/Modal.css';

const latestSunday = () => {
  const date = new Date();
  date.setDate(date.getDate() - date.getDay());
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const AttendanceModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ serviceDate: latestSunday(), attendanceCount: '', remarks: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await analyticsService.recordSundayAttendance({ ...form, attendanceCount: Number(form.attendanceCount) });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to record attendance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={saving ? undefined : onClose}>
      <div className="modal modal--sm" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="attendance-title">
        <div className="modal__header">
          <div>
            <h2 className="modal__title" id="attendance-title">Record Sunday Attendance</h2>
            <p className="modal__subtitle">Existing attendance for the selected Sunday will be updated.</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} disabled={saving} aria-label="Close"><CloseIcon /></button>
        </div>
        <form className="modal__body attendance-modal__body" onSubmit={submit}>
          {error && <div className="modal__error-banner" role="alert">{error}</div>}
          <div className="form-field">
            <label className="form-label" htmlFor="attendance-service-date">Service date *</label>
            <input id="attendance-service-date" className="form-input" type="date" required max={today()} value={form.serviceDate} onChange={(event) => setForm({ ...form, serviceDate: event.target.value })} />
            <small className="form-helper-text">Please choose a Sunday.</small>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="attendance-count">Attendance *</label>
            <input id="attendance-count" className="form-input" type="number" min="0" step="1" required placeholder="Number of attendees" value={form.attendanceCount} onChange={(event) => setForm({ ...form, attendanceCount: event.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="attendance-remarks">Remarks (optional)</label>
            <textarea id="attendance-remarks" className="form-input" rows="3" maxLength="1000" value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} />
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--ghost btn--md" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary btn--md" disabled={saving}>{saving ? 'Saving…' : 'Save Attendance'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AttendanceModal;
