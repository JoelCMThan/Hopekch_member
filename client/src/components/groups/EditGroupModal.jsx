import { useState, useEffect } from 'react';
import groupService from '../../services/groupService';
import memberService from '../../services/memberService';
import MeetingLocationPicker from './MeetingLocationPicker';
import './GroupModal.css';

const EditGroupModal = ({ group, onClose, onSave }) => {
  const [form, setForm] = useState({
    groupName: '',
    unitId: '',
    leaderMemberId: '',
    groupAddress: '',
    latitude: null,
    longitude: null,
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  const [subdistricts, setSubdistricts] = useState([]);
  const [selectedSubdistrictId, setSelectedSubdistrictId] = useState('');
  const [allUnits, setAllUnits] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  useEffect(() => {
    if (!group) return;

    setForm({
      groupName: group.LifeGroupName ?? '',
      unitId: group.UnitID ? String(group.UnitID) : '',
      leaderMemberId: '',
      groupAddress: group.MeetingAddress ?? '',
      latitude: group.Latitude != null ? Number(group.Latitude) : null,
      longitude: group.Longitude != null ? Number(group.Longitude) : null,
    });
  }, [group]);

  useEffect(() => {
    let cancelled = false;
    setLoadingLookups(true);

    Promise.all([
      groupService.getSubdistricts().then((r) => r.data?.data ?? r.data ?? []),
      groupService.getUnits().then((r) => r.data?.data ?? r.data ?? []),
      memberService.getMembers({ limit: 200 }).then((r) => r.data?.data?.members ?? []),
    ])
      .then(([subdistrictData, unitsData, membersData]) => {
        if (cancelled) return;

        setSubdistricts(subdistrictData);
        setAllUnits(unitsData);
        setMembers(membersData);

        const initialSubdistrict = group?.SubdistrictID
          ? String(group.SubdistrictID)
          : (unitsData.find((unit) => String(unit.UnitID) === String(group?.UnitID))?.SubdistrictID ?? '');

        setSelectedSubdistrictId(initialSubdistrict ? String(initialSubdistrict) : '');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingLookups(false);
      });

    return () => {
      cancelled = true;
    };
  }, [group?.LifeGroupID, group?.SubdistrictID, group?.UnitID]);

  const units = selectedSubdistrictId
    ? allUnits.filter(
        (unit) =>
          String(unit.SubdistrictID) === String(selectedSubdistrictId)
      )
    : allUnits;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setApiError(null);

    if (name === 'unitId') {
      const matchedUnit = allUnits.find((unit) => String(unit.UnitID) === String(value));
      if (matchedUnit?.SubdistrictID) {
        setSelectedSubdistrictId(String(matchedUnit.SubdistrictID));
      } else if (!value) {
        setSelectedSubdistrictId('');
      }
    }
  };

  const handleSubdistrictChange = (e) => {
    const value = e.target.value;
    setSelectedSubdistrictId(value);
    setForm((prev) => ({ ...prev, unitId: '' }));
    setErrors((prev) => ({ ...prev, unitId: undefined }));
    setApiError(null);
  };

  const validate = () => {
    const next = {};
    if (!form.groupName.trim()) next.groupName = 'Group name is required';
    if (!form.unitId) next.unitId = 'Unit is required';
    return next;
  };

  const handleSubmit = async () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setApiError(null);
    try {
      await groupService.updateGroup(group.LifeGroupID, {
        groupName: form.groupName.trim(),
        unitId: Number(form.unitId),
        leaderMemberId: form.leaderMemberId ? Number(form.leaderMemberId) : null,
        groupAddress: form.groupAddress.trim() || null,
        latitude: form.latitude,
        longitude: form.longitude,
      });
      onSave();
    } catch (err) {
      setApiError(err.response?.data?.message ?? 'Failed to update group');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="group-modal-overlay" role="dialog" aria-modal="true">
      <div className="group-modal">
        <div className="group-modal__header">
          <div>
            <h2 className="group-modal__title">Edit Life Group</h2>
            <p className="group-modal__subtitle">Update the hierarchy for this life group and assign a leader.</p>
          </div>
          <button className="group-modal__close" onClick={onClose} aria-label="Close modal">×</button>
        </div>

        <div className="group-modal__body">
          <div className="organization-leaders">
            <p>Leaders: {group.LeaderNames || 'Unassigned'}</p>
            <p>Assistant Leaders: {group.AssistantLeaderNames || 'Unassigned'}</p>
            <p>Adding a leader keeps the current assignments. Manage individual roles in Member Management.</p>
          </div>
          {apiError && <p className="group-modal__api-error">{apiError}</p>}

          <div className="group-modal__field">
            <label className="group-modal__label" htmlFor="edit-group-name">Group Name</label>
            <input
              id="edit-group-name"
              name="groupName"
              value={form.groupName}
              onChange={handleChange}
              className="group-modal__input"
              placeholder="e.g. Grace Fellowship"
              disabled={submitting}
            />
            {errors.groupName && <span className="group-modal__error">{errors.groupName}</span>}
          </div>

          <div className="group-modal__field">
            <label className="group-modal__label" htmlFor="edit-group-subdistrict">Subdistrict</label>
            <select
              id="edit-group-subdistrict"
              value={selectedSubdistrictId}
              onChange={handleSubdistrictChange}
              className="group-modal__select"
              disabled={submitting || loadingLookups}
            >
              <option value="">{loadingLookups ? 'Loading…' : 'Select subdistrict'}</option>
              {subdistricts.map((subdistrict) => (
                <option key={subdistrict.SubdistrictID} value={subdistrict.SubdistrictID}>
                  {subdistrict.SubdistrictName}
                </option>
              ))}
            </select>
          </div>

          <div className="group-modal__field">
            <label className="group-modal__label" htmlFor="edit-group-unit">Unit</label>
            <select
              id="edit-group-unit"
              name="unitId"
              value={form.unitId}
              onChange={handleChange}
              className="group-modal__select"
              disabled={submitting || loadingLookups}
            >
              <option value="">{loadingLookups ? 'Loading…' : 'Select unit'}</option>
              {units.map((unit) => (
                <option key={unit.UnitID} value={unit.UnitID}>
                  {unit.UnitName}
                </option>
              ))}
            </select>
            {errors.unitId && <span className="group-modal__error">{errors.unitId}</span>}
          </div>

          <div className="group-modal__field">
            <label className="group-modal__label" htmlFor="edit-group-leader">Add Leader</label>
            <select
              id="edit-group-leader"
              name="leaderMemberId"
              value={form.leaderMemberId}
              onChange={handleChange}
              className="group-modal__select"
              disabled={submitting || loadingLookups}
            >
              <option value="">{loadingLookups ? 'Loading…' : 'Keep current leaders'}</option>
              {members.map((member) => (
                <option key={member.MemberID} value={member.MemberID}>
                  {member.FirstName} {member.LastName}
                </option>
              ))}
            </select>
          </div>
          <MeetingLocationPicker key={group.LifeGroupID} value={form} disabled={submitting} onChange={(location) => {
            setForm((prev) => ({ ...prev, ...location }));
            setApiError(null);
          }} />
        </div>

        <div className="group-modal__actions">
          <button type="button" className="btn btn--ghost btn--md" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--md btn--primary"
            onClick={handleSubmit}
            disabled={submitting || loadingLookups}
          >
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditGroupModal;
