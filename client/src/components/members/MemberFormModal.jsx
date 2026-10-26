/**
 * MemberFormModal
 * used for create + edit member
 */

import { useState, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import memberService from '../../services/memberService';
import {
  canSetSubdistrict, canSetUnit, canSetLifeGroup,
  canResetPassword, canMarkInactive, canEditMember,
  getAssignableRoleOptions, getRoleLabel, ROLES
} from '../../permissions';
import ConfirmDialog from '../layout/ConfirmDialog';
import './Modal.css';
import { CloseIcon } from '../icons';

const MEMBERSHIP_TYPES = ['Member', 'Visitor', 'Consistent Visitor'];
const BELIEVER_STATUSES = ['Pre-believer', 'Believer', 'New Believer'];
const GENDERS = ['Male', 'Female'];
const MARITAL_STATUSES = ['Single', 'Married', 'Widowed', 'Divorced'];
const INACTIVE_REASONS = ['Transferred University', 'Moved', 'Changed Church', 'Migrant', 'Personal', 'Others'];

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '',
  gender: '', birthDate: '', maritalStatus: '',
  membershipType: 'Member',
  believerStatus: '',
  membershipIsActive: true, inactiveReason: '', inactiveNotes: '',
  joinDate: new Date().toISOString().slice(0, 10),
  memberSince: new Date().toISOString().slice(0, 10),
  lifeGroupId: '',
  subdistrictId: '',
  unitId: '',
  mobileNumber: '', landlineNumber: '',

  // Address
  streetAddress: '', city: '', state: '', postalCode: '', country: '',

  // Baptism
  isBaptized: false,
  baptismDate: '',
  baptismVenue: '',
  baptismRemarks: '',

  // Engagement
  isActiveEngage: false,
  isActiveLifeGroup: false,
  isActiveSundayService: false,
  isActiveServing: false,

  // User account
  role: 'member',
};

const normalizeFormForCompare = (form) => ({
  firstName: form.firstName.trim(),
  lastName: form.lastName.trim(),
  email: form.email.trim(),
  gender: form.gender || '',
  birthDate: form.birthDate || '',
  maritalStatus: form.maritalStatus || '',
  membershipType: form.membershipType || 'Member',
  believerStatus: form.believerStatus || '',
  membershipIsActive: Boolean(form.membershipIsActive),
  inactiveReason: form.inactiveReason || '',
  inactiveNotes: form.inactiveNotes || '',
  joinDate: form.joinDate || '',
  memberSince: form.memberSince || '',
  lifeGroupId: form.lifeGroupId ? String(form.lifeGroupId) : '',
  subdistrictId: form.subdistrictId ? String(form.subdistrictId) : '',
  unitId: form.unitId ? String(form.unitId) : '',
  mobileNumber: form.mobileNumber || '',
  landlineNumber: form.landlineNumber || '',
  streetAddress: form.streetAddress || '',
  city: form.city || '',
  state: form.state || '',
  postalCode: form.postalCode || '',
  country: form.country || '',
  isBaptized: Boolean(form.isBaptized),
  baptismDate: form.baptismDate || '',
  baptismVenue: form.baptismVenue || '',
  baptismRemarks: form.baptismRemarks || '',
  isActiveEngage: Boolean(form.isActiveEngage),
  isActiveLifeGroup: Boolean(form.isActiveLifeGroup),
  isActiveSundayService: Boolean(form.isActiveSundayService),
  isActiveServing: Boolean(form.isActiveServing),
  role: form.role || 'member',
});

const findUnitSubdistrict = (unitId, units) => {
  const unit = units.find((item) => String(item.UnitID) === String(unitId));
  return unit?.SubdistrictID ? String(unit.SubdistrictID) : '';
};

const MemberFormModal = ({ member, onClose, onSave }) => {
  const isEdit = Boolean(member);
  const { user } = useAuth();
  const role = user?.role;

  const showSubdistrict = canSetSubdistrict(role);
  const showUnit = canSetUnit(role);
  const showLifeGroup = canSetLifeGroup(role);
  const isSelfEdit = [ROLES.CORE_TEAM, ROLES.MEMBER].includes(role);
  const showActiveSection = canMarkInactive(role);
  const showPasswordSection = isEdit && canResetPassword(role, member?.Role);
  const showRoleSection = !isEdit;
  const showRoleAssignmentInMembership = isEdit && !isSelfEdit && canEditMember(role);
  const assignableRoles = getAssignableRoleOptions(role);

  const [form, setForm] = useState(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_FORM);

  const [subdistricts, setSubdistricts] = useState([]);
  const [allUnits, setAllUnits] = useState([]);
  const [lifeGroups, setLifeGroups] = useState([]);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const units = form.subdistrictId
    ? allUnits.filter((u) => String(u.SubdistrictID) === String(form.subdistrictId))
    : allUnits;

  /* Populate edit form */
  useEffect(() => {
    if (!member) {
      setForm(EMPTY_FORM);
      setInitialForm(EMPTY_FORM);
      return;
    }

    const nextForm = {
      firstName: member.FirstName ?? '',
      lastName: member.LastName ?? '',
      email: member.Email ?? '',
      gender: member.Gender ?? '',
      birthDate: member.BirthDate ? member.BirthDate.slice(0, 10) : '',
      maritalStatus: member.MaritalStatus ?? '',
      membershipType: member.MembershipType ?? 'Member',
      believerStatus: member.BelieverStatus ?? '',
      membershipIsActive: Boolean(member.MembershipIsActive ?? true),
      inactiveReason: member.InactiveReason ?? '',
      inactiveNotes: member.InactiveNotes ?? '',
      joinDate: member.JoinDate ? member.JoinDate.slice(0, 10) : '',
      memberSince: member.MemberSince ? member.MemberSince.slice(0, 10) : '',
      lifeGroupId: member.LifeGroupID ? String(member.LifeGroupID) : '',
      subdistrictId: member.SubdistrictID ? String(member.SubdistrictID) : '',
      unitId: member.UnitID ? String(member.UnitID) : '',

      mobileNumber: member.MobileNumber ?? '',
      landlineNumber: member.LandlineNumber ?? '',

      streetAddress: member.StreetAddress ?? '',
      city: member.City ?? '',
      state: member.State ?? '',
      postalCode: member.PostalCode ?? '',
      country: member.Country ?? '',

      isBaptized: Boolean(member.isBaptized),
      baptismDate: member.BaptismDate ? member.BaptismDate.slice(0, 10) : '',
      baptismVenue: member.BaptismVenue ?? '',
      baptismRemarks: member.BaptismRemarks ?? '',

      isActiveEngage: Boolean(member.IsActiveEngage ?? false),
      isActiveLifeGroup: Boolean(member.IsActiveLifeGroup ?? false),
      isActiveSundayService: Boolean(member.IsActiveSundayService ?? false),
      isActiveServing: Boolean(member.IsActiveServing ?? false),

      role: member.Role ?? 'member',
    };

    setForm(nextForm);
    setInitialForm(nextForm);
  }, [member]);

  /* Load subdistricts */
  useEffect(() => {
    if (!showSubdistrict) return;

    memberService.getSubdistricts({ usableOnly: true })
      .then((res) => setSubdistricts(res.data.data ?? []))
      .catch(() => {});
  }, [showSubdistrict]);

  /* Load units */
  useEffect(() => {
    if (!showUnit) return;

    memberService.getUnits({ usableOnly: true })
      .then((res) => setAllUnits(res.data.data ?? []))
      .catch(() => {});
  }, [showUnit]);

  /* Load life groups */
  useEffect(() => {
    if (!showLifeGroup) return;

    memberService.getLifeGroups(
      form.unitId || undefined,
      form.subdistrictId || undefined,
      { usableOnly: true }
    )
      .then((res) => setLifeGroups(res.data.data ?? []))
      .catch(() => {});
  }, [showLifeGroup, form.subdistrictId, form.unitId]);

  /* Input handler */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'membershipType' && value === 'Member'
        ? { believerStatus: '' }
        : {}),
    }));

    setErrors((prev) => ({
      ...prev,
      _global: undefined,
      [name]: undefined,
      ...(name === 'membershipType'
        ? { believerStatus: undefined }
        : {}),
    }));
  };

  const handleSubdistrictChange = (e) => {
    const value = e.target.value;

    setForm((prev) => ({
      ...prev,
      subdistrictId: value,
      unitId: '',
      lifeGroupId: '',
    }));
  };

  const handleUnitChange = (e) => {
    const value = e.target.value;
    const subdistrictId = findUnitSubdistrict(value, allUnits);

    setForm((prev) => ({
      ...prev,
      subdistrictId: subdistrictId || prev.subdistrictId,
      unitId: value,
      lifeGroupId: '',
    }));
  };

  const handleLifeGroupChange = (e) => {
    const value = e.target.value;

    if (!value) {
      setForm((prev) => ({
        ...prev,
        lifeGroupId: '',
      }));
      return;
    }

    const group = lifeGroups.find(
      (g) => String(g.LifeGroupID) === String(value)
    );

    setForm((prev) => ({
      ...prev,
      lifeGroupId: value,
      unitId: group?.UnitID ? String(group.UnitID) : prev.unitId,
      subdistrictId: group?.SubdistrictID
        ? String(group.SubdistrictID)
        : prev.subdistrictId,
    }));
  };

  /* Validation */
  const validate = () => {
    const errs = {};

    if (!form.firstName.trim()) {
      errs.firstName = 'First name required';
    }

    if (!form.lastName.trim()) {
      errs.lastName = 'Last name required';
    }

    if (!form.email.trim()) {
      errs.email = 'Email required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Invalid email';
    }

    if (!isEdit) {
      if (!newPassword) {
        errs.password = 'Password required';
      } else if (newPassword.length < 6) {
        errs.password = 'Password must be at least 6 characters';
      } else if (newPassword !== confirmPassword) {
        errs.confirmPassword = 'Passwords do not match';
      }

      if (!form.role) {
        errs.role = 'Role required';
      }
    }

    if (form.isBaptized && !form.baptismDate) {
      errs.baptismDate = 'Baptism date required';
    }
    if (isEdit && showActiveSection && !form.membershipIsActive &&
        (form.membershipIsActive !== initialForm.membershipIsActive ||
         form.inactiveReason !== initialForm.inactiveReason || form.inactiveNotes !== initialForm.inactiveNotes) &&
        !INACTIVE_REASONS.includes(form.inactiveReason)) {
      errs.inactiveReason = 'Select an inactive reason';
    }

    if (
      ['Visitor', 'Consistent Visitor'].includes(form.membershipType) &&
      !form.believerStatus
    ) {
      errs.believerStatus =
        'Believer status is required for Visitor or Consistent Visitor';
    }

    return errs;
  };

  const hasChanges = () => {
    const formChanged =
      JSON.stringify(normalizeFormForCompare(form)) !==
      JSON.stringify(normalizeFormForCompare(initialForm));

    const passwordChanged = Boolean(newPassword || confirmPassword);

    return formChanged || passwordChanged;
  };

  const hasSectionError = (...keys) => keys.some((key) => errors[key]);

  /* Submit */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const errs = validate();

    if (Object.keys(errs).length > 0) {
      setErrors({
        ...errs,
        _global: 'Please complete the highlighted required fields before saving.',
      });
      return;
    }

    if (isEdit && !hasChanges()) {
      onClose();
      return;
    }

    if (isEdit) {
      setShowConfirm(true);
      return;
    }

    await doSave();
  };

  const doSave = async () => {
    setShowConfirm(false);
    setSaving(true);

    try {
      if (
        isEdit &&
        showPasswordSection &&
        (newPassword || confirmPassword)
      ) {
        if (newPassword.length < 6) {
          setErrors((prev) => ({
            ...prev,
            _global: 'Password must be at least 6 characters.',
          }));
          return;
        }

        if (newPassword !== confirmPassword) {
          setErrors((prev) => ({
            ...prev,
            _global: 'Passwords do not match.',
          }));
          return;
        }
      }

      const payload = {
        ...form,
        subdistrictId: form.subdistrictId || null,
        unitId: form.unitId || null,
        lifeGroupId: form.lifeGroupId || null,

        gender: form.gender || null,
        birthDate: form.birthDate || null,
        maritalStatus: form.maritalStatus || null,

        membershipType: form.membershipType || 'Member',
        believerStatus: ['Visitor', 'Consistent Visitor'].includes(form.membershipType)
          ? form.believerStatus || null
          : null,

        joinDate: form.joinDate || null,
        memberSince: form.memberSince || null,

        mobileNumber: form.mobileNumber || null,
        landlineNumber: form.landlineNumber || null,

        streetAddress: form.streetAddress || null,
        city: form.city || null,
        state: form.state || null,
        postalCode: form.postalCode || null,
        country: form.country || null,

        isBaptized: Boolean(form.isBaptized),
        baptismDate: form.isBaptized
          ? form.baptismDate || null
          : null,
        baptismVenue: form.isBaptized
          ? form.baptismVenue || null
          : null,
        baptismRemarks: form.isBaptized
          ? form.baptismRemarks || null
          : null,

        isActiveEngage: Boolean(form.isActiveEngage),
        isActiveLifeGroup: Boolean(form.isActiveLifeGroup),
        isActiveSundayService: Boolean(form.isActiveSundayService),
        isActiveServing: Boolean(form.isActiveServing),

        role: form.role || 'member',
      };

      if (!isEdit) {
        payload.password = newPassword;
      }
      delete payload.membershipIsActive;
      delete payload.inactiveReason;
      delete payload.inactiveNotes;
      if (isEdit && showActiveSection && (
        form.membershipIsActive !== initialForm.membershipIsActive ||
        form.inactiveReason !== initialForm.inactiveReason ||
        form.inactiveNotes !== initialForm.inactiveNotes
      )) {
        payload.membershipIsActive = form.membershipIsActive;
        payload.inactiveReason = form.membershipIsActive ? null : form.inactiveReason;
        payload.inactiveNotes = form.membershipIsActive ? null : form.inactiveNotes || null;
      }

      if (isEdit) {
        await memberService.updateMember(member.MemberID, payload);

        if (showPasswordSection && newPassword) {
          await memberService.resetPassword(member.MemberID, newPassword);
        }
      } else {
        await memberService.createMember(payload);
      }

      onSave();
    } catch (err) {
      setErrors({
        _global:
          err.response?.data?.message ??
          'Save failed. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal modal--wide"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="modal__header">
            <h2 className="modal__title">
              {isEdit ? 'Edit Member' : 'Add Member'}
            </h2>

            <button
              className="modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>

          <form className="modal__body" onSubmit={handleSubmit}>
            {errors._global && (
              <div className="modal__error-banner">
                {errors._global}
              </div>
            )}

            {/* Personal */}
            <fieldset
              className={`modal__section${
                hasSectionError('firstName', 'lastName', 'email')
                  ? ' modal__section--error'
                  : ''
              }`}
            >
              <legend className="modal__section-title">
                Personal Details
              </legend>

              <div className="form-row form-row--2">
                <div className="form-field">
                  <label className="form-label">First Name *</label>
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    className={`form-input${
                      errors.firstName ? ' form-input--error' : ''
                    }`}
                  />
                  {errors.firstName && (
                    <span className="form-error">
                      {errors.firstName}
                    </span>
                  )}
                </div>

                <div className="form-field">
                  <label className="form-label">Last Name *</label>
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    className={`form-input${
                      errors.lastName ? ' form-input--error' : ''
                    }`}
                  />
                  {errors.lastName && (
                    <span className="form-error">
                      {errors.lastName}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className={`form-input${
                    errors.email ? ' form-input--error' : ''
                  }`}
                />
                {errors.email && (
                  <span className="form-error">{errors.email}</span>
                )}
              </div>

              <div className="form-row form-row--3">
                <div className="form-field">
                  <label className="form-label">Gender</label>
                  <select
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="">— Select —</option>
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    name="birthDate"
                    value={form.birthDate}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Marital Status</label>
                  <select
                    name="maritalStatus"
                    value={form.maritalStatus}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="">— Select —</option>
                    {MARITAL_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            {/* Membership */}
            {(
              <fieldset
                disabled={isSelfEdit}
                className={`modal__section${
                  hasSectionError('believerStatus')
                    ? ' modal__section--error'
                    : ''
                }`}
              >
                <legend className="modal__section-title">
                  Membership
                </legend>

                <div className="form-row form-row--2">
                  <div className="form-field">
                    <label className="form-label">
                      Membership Type
                    </label>

                    <select
                      name="membershipType"
                      value={form.membershipType}
                      onChange={handleChange}
                      className="form-select"
                    >
                      {MEMBERSHIP_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {['Visitor', 'Consistent Visitor'].includes(
                    form.membershipType
                  ) && (
                    <div className="form-field">
                      <label className="form-label">
                        Believer Status
                      </label>

                      <select
                        name="believerStatus"
                        value={form.believerStatus}
                        onChange={handleChange}
                        className={`form-select${
                          errors.believerStatus
                            ? ' form-input--error'
                            : ''
                        }`}
                      >
                        <option value="">— Select —</option>
                        {BELIEVER_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>

                      {errors.believerStatus && (
                        <span className="form-error">
                          {errors.believerStatus}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="form-field">
                    <label className="form-label">Join Date</label>
                    <input
                      type="date"
                      name="joinDate"
                      value={form.joinDate}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Member Since</label>
                    <input type="date" name="memberSince" value={form.memberSince}
                      onChange={handleChange} className="form-input" />
                  </div>

                  {showRoleAssignmentInMembership && (
                    <div className="form-field">
                      <label className="form-label">
                        Account Role
                      </label>

                      <select
                        name="role"
                        value={form.role}
                        onChange={handleChange}
                        className="form-select"
                      >
                        {assignableRoles.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {isEdit && !showRoleAssignmentInMembership && (
                    <div className="form-field">
                      <label className="form-label">Account Role</label>
                      <input value={getRoleLabel(member.Role)} readOnly className="form-input" />
                    </div>
                  )}
                </div>
              </fieldset>
            )}

            {/* Church Grouping */}
            {(isEdit || showSubdistrict || showUnit || showLifeGroup) && (
              <fieldset className="modal__section">
                <legend className="modal__section-title">
                  Church Grouping
                </legend>
                {isEdit && [
                  ['Subdistrict', member.SubdistrictName, showSubdistrict],
                  ['Unit', member.UnitName, showUnit],
                  ['Life Group', member.LifeGroupName, showLifeGroup],
                ].filter(([, , editable]) => !editable).map(([label, value]) => (
                  <div className="form-field" key={label}>
                    <label className="form-label">{label}</label>
                    <input value={value || '—'} readOnly className="form-input" />
                  </div>
                ))}

                {showSubdistrict && (
                  <div className="form-field">
                    <label className="form-label">
                      Subdistrict
                    </label>

                    <select
                      value={form.subdistrictId}
                      onChange={handleSubdistrictChange}
                      className="form-select"
                    >
                      <option value="">None</option>
                      {form.subdistrictId && !subdistricts.some(item => String(item.SubdistrictID) === String(form.subdistrictId)) && (
                          <option value={form.subdistrictId} disabled>{member?.SubdistrictName || 'Current assignment'} (unavailable)</option>
                        )}
                        {subdistricts.map((s) => (
                        <option
                          key={s.SubdistrictID}
                          value={s.SubdistrictID}
                        >
                          {s.SubdistrictName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-row form-row--2">
                  {showUnit && (
                    <div className="form-field">
                      <label className="form-label">Unit</label>

                      <select
                        value={form.unitId}
                        onChange={handleUnitChange}
                        className="form-select"
                      >
                        <option value="">None</option>
                        {form.unitId && !units.some(item => String(item.UnitID) === String(form.unitId)) && (
                          <option value={form.unitId} disabled>{member?.UnitName || 'Current assignment'} (unavailable)</option>
                        )}
                        {units.map((u) => (
                          <option key={u.UnitID} value={u.UnitID}>
                            {u.UnitName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {showLifeGroup && (
                    <div className="form-field">
                      <label className="form-label">
                        Life Group
                      </label>

                      <select
                        name="lifeGroupId"
                        value={form.lifeGroupId}
                        onChange={handleLifeGroupChange}
                        className="form-select"
                      >
                        <option value="">None</option>
                        {form.lifeGroupId && !lifeGroups.some(item => String(item.LifeGroupID) === String(form.lifeGroupId)) && (
                          <option value={form.lifeGroupId} disabled>{member?.LifeGroupName || 'Current assignment'} (unavailable)</option>
                        )}
                        {lifeGroups.map((g) => (
                          <option
                            key={g.LifeGroupID}
                            value={g.LifeGroupID}
                          >
                            {g.LifeGroupName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </fieldset>
            )}

            {/* Address */}
            <fieldset className="modal__section">
              <legend className="modal__section-title">Address</legend>

              <div className="form-field">
                <label className="form-label">Street Address</label>
                <input
                  name="streetAddress"
                  value={form.streetAddress}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              <div className="form-row form-row--2">
                <div className="form-field">
                  <label className="form-label">City</label>
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">State</label>
                  <input
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row form-row--2">
                <div className="form-field">
                  <label className="form-label">Postal Code</label>
                  <input
                    name="postalCode"
                    value={form.postalCode}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Country</label>
                  <input
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
              </div>
            </fieldset>

            {/* Baptism */}
            {!isSelfEdit && (
              <fieldset
                className={`modal__section${
                  hasSectionError('baptismDate')
                    ? ' modal__section--error'
                    : ''
                }`}
              >
                <legend className="modal__section-title">
                  Baptism
                </legend>

                <div className="form-field form-field--checkbox">
                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      name="isBaptized"
                      checked={form.isBaptized}
                      onChange={handleChange}
                      className="form-checkbox"
                    />
                    <span>Member has been baptized</span>
                  </label>
                </div>

                {form.isBaptized && (
                  <>
                    <div className="form-row form-row--2">
                      <div className="form-field">
                        <label className="form-label">
                          Baptism Date *
                        </label>

                        <input
                          type="date"
                          name="baptismDate"
                          value={form.baptismDate}
                          onChange={handleChange}
                          className={`form-input${
                            errors.baptismDate
                              ? ' form-input--error'
                              : ''
                          }`}
                        />

                        {errors.baptismDate && (
                          <span className="form-error">
                            {errors.baptismDate}
                          </span>
                        )}
                      </div>

                      <div className="form-field">
                        <label className="form-label">Venue</label>
                        <input
                          name="baptismVenue"
                          value={form.baptismVenue}
                          onChange={handleChange}
                          className="form-input"
                        />
                      </div>
                    </div>

                    <div className="form-field">
                      <label className="form-label">Remarks</label>
                      <textarea
                        name="baptismRemarks"
                        value={form.baptismRemarks}
                        onChange={handleChange}
                        className="form-input form-textarea"
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </fieldset>
            )}

            {/* Contact */}
            <fieldset className="modal__section">
              <legend className="modal__section-title">Contact</legend>

              <div className="form-row form-row--2">
                <div className="form-field">
                  <label className="form-label">
                    Mobile Number
                  </label>
                  <input
                    name="mobileNumber"
                    value={form.mobileNumber}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">
                    Landline Number
                  </label>
                  <input
                    name="landlineNumber"
                    value={form.landlineNumber}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
              </div>
            </fieldset>

            {isEdit && (
              <fieldset className={`modal__section${errors.inactiveReason ? ' modal__section--error' : ''}`}>
                <legend className="modal__section-title">Membership Status</legend>
                <div className="form-field">
                  <label className="form-label" htmlFor="membershipIsActive">Status</label>
                  <select id="membershipIsActive" name="membershipIsActive"
                    value={String(form.membershipIsActive)} disabled={!showActiveSection}
                    onChange={(event) => setForm(prev => ({ ...prev, membershipIsActive: event.target.value === 'true' }))}
                    className="form-select">
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                {!form.membershipIsActive && (
                  <>
                    <div className="form-field">
                      <label className="form-label" htmlFor="inactiveReason">Inactive Reason *</label>
                      <select id="inactiveReason" name="inactiveReason" value={form.inactiveReason}
                        onChange={handleChange} disabled={!showActiveSection}
                        className={`form-select${errors.inactiveReason ? ' form-input--error' : ''}`}>
                        <option value="">Select a reason</option>
                        {INACTIVE_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                      </select>
                      {errors.inactiveReason && <span className="form-error">{errors.inactiveReason}</span>}
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="inactiveNotes">Notes</label>
                      <textarea id="inactiveNotes" name="inactiveNotes" value={form.inactiveNotes}
                        onChange={handleChange} disabled={!showActiveSection} className="form-input" rows={3} />
                    </div>
                  </>
                )}
              </fieldset>
            )}

            {/* Engagement Status */}
            {(isEdit || showActiveSection) && (
              <fieldset className="modal__section" disabled={!showActiveSection}>
                <legend className="modal__section-title">
                  Member Engagement
                </legend>

                <div className="form-checkbox-group">
                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      name="isActiveEngage"
                      checked={form.isActiveEngage}
                      onChange={handleChange}
                      className="form-checkbox"
                    />
                    <span>Active</span>
                  </label>

                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      name="isActiveLifeGroup"
                      checked={form.isActiveLifeGroup}
                      onChange={handleChange}
                      className="form-checkbox"
                    />
                    <span>Active in Life Group</span>
                  </label>

                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      name="isActiveSundayService"
                      checked={form.isActiveSundayService}
                      onChange={handleChange}
                      className="form-checkbox"
                    />
                    <span>Active in Sunday Service</span>
                  </label>

                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      name="isActiveServing"
                      checked={form.isActiveServing}
                      onChange={handleChange}
                      className="form-checkbox"
                    />
                    <span>Active in Serving</span>
                  </label>
                </div>
              </fieldset>
            )}

            {/* Password */}
            {showPasswordSection && (
              <fieldset className="modal__section">
                <legend className="modal__section-title">
                  Password {member?.UserID ? '(Reset)' : '(Set Initial)'}
                </legend>

                <p className="form-helper-text">
                  {member?.UserID
                    ? 'Leave blank to keep the current password. Fill in to set a new one.'
                    : 'Set an initial login password for this member.'}
                </p>

                <div className="form-row form-row--2">
                  <div className="form-field">
                    <label className="form-label">
                      New Password
                    </label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="form-input"
                      placeholder="Min. 6 characters"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">
                      Confirm Password
                    </label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="form-input"
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <label className="form-checkbox-label form-checkbox-label--sm">
                  <input
                    type="checkbox"
                    checked={showPasswords}
                    onChange={() => setShowPasswords((v) => !v)}
                    className="form-checkbox"
                  />
                  <span>Show passwords</span>
                </label>
              </fieldset>
            )}

            {/* User Account */}
            {showRoleSection && (
              <fieldset
                className={`modal__section${
                  errors.password || errors.role
                    ? ' modal__section--error'
                    : ''
                }`}
              >
                <legend className="modal__section-title">
                  User Account
                </legend>

                <div className="form-row form-row--2">
                  <div className="form-field">
                    <label className="form-label">Role *</label>

                    <select
                      name="role"
                      value={form.role}
                      onChange={handleChange}
                      className={`form-select${
                        errors.role ? ' form-input--error' : ''
                      }`}
                    >
                      <option value="">— Select —</option>

                      {assignableRoles.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {errors.role && (
                      <span className="form-error">
                        {errors.role}
                      </span>
                    )}
                  </div>

                  <div className="form-field">
                    <label className="form-label">
                      Initial Password *
                    </label>

                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`form-input${
                        errors.password ? ' form-input--error' : ''
                      }`}
                      placeholder="Min. 6 characters"
                      autoComplete="new-password"
                    />

                    {errors.password && (
                      <span className="form-error">
                        {errors.password}
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-row form-row--2">
                  <div className="form-field">
                    <label className="form-label">
                      Confirm Password *
                    </label>

                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`form-input${
                        errors.confirmPassword
                          ? ' form-input--error'
                          : ''
                      }`}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                    />

                    {errors.confirmPassword && (
                      <span className="form-error">
                        {errors.confirmPassword}
                      </span>
                    )}
                  </div>

                  <div className="form-password-toggle">
                    <label className="form-checkbox-label form-checkbox-label--sm form-checkbox-label--no-margin">
                      <input
                        type="checkbox"
                        checked={showPasswords}
                        onChange={() => setShowPasswords((v) => !v)}
                        className="form-checkbox"
                      />
                      <span>Show passwords</span>
                    </label>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Footer */}
            <div className="modal__footer">
              <button
                type="button"
                className="btn btn--ghost btn--md"
                onClick={onClose}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn--primary btn--md"
                disabled={saving}
              >
                {saving
                  ? 'Saving…'
                  : isEdit
                    ? 'Save Changes'
                    : 'Add Member'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirm edit dialog */}
      {showConfirm && (
        <ConfirmDialog
          title="Confirm Changes"
          message="Are you sure you want to save these changes to this member's record?"
          confirmLabel="Yes, Save"
          cancelLabel="Go Back"
          onConfirm={doSave}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
};

export default MemberFormModal;
