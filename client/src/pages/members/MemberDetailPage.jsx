/**
 * src/pages/members/MemberDetailPage.jsx
 *
 * Full member detail view. Route: /members/:id (inside <Layout>)
 * Accessible to all Members-module roles.
 * Edit shown for admin/manager; Delete shown for admin only.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import memberService from '../../services/memberService';
import { canManageMember, canEditMember, canDeleteMember, canDeactivateMember, canResetPassword, canSeeBelieverStatus, getRoleLabel } from '../../permissions';
import DeactivateMemberModal from '../../components/inactiveMembers/DeactivateMemberModal';
import MemberFormModal     from '../../components/members/MemberFormModal';
import MemberDeleteModal   from '../../components/members/MemberDeleteModal';
import ResetPasswordModal  from '../../components/members/ResetPasswordModal';
import { BackIcon, EditIcon, TrashIcon, HomeIcon, WaterIcon, UserIcon, PhoneIcon, ChurchIcon } from '../../components/icons';
import './MemberDetail.css';

const membershipBadgeClass = (membershipType) => {
  const key = (membershipType ?? '').toLowerCase();

  if (key === 'consistent visitor') return 'badge--consistent-visitor';
  if (key === 'visitor') return 'badge--visitor';
  return 'badge--member';
};

/* ── Helpers ────────────────────────────────────────────────── */
const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

const DetailRow = ({ label, value }) => (
  <div className="detail-row">
    <dt className="detail-row__label">{label}</dt>
    <dd className="detail-row__value">{value || '—'}</dd>
  </div>
);

/* ── Page component ─────────────────────────────────────────── */
const MemberDetailPage = () => {
  const { id }        = useParams();
  const navigate      = useNavigate();
  const { user }      = useAuth();
  const role          = user?.role;
  const isSelf         = Number(id) === Number(user?.memberId);

  const canViewBelieverStatus = canSeeBelieverStatus(role, isSelf);

  const [member,       setMember]       = useState(null);
  const canManage = canManageMember(role, member?.Role);
  const canEdit = canManage && canEditMember(role);
  const canDelete = canManage && canDeleteMember(role);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState(null);
  const [showEdit,     setShowEdit]     = useState(false);
  const [showDelete,   setShowDelete]   = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showResetPwd, setShowResetPwd] = useState(false);

  const loadMember = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await memberService.getMember(id);
      setMember(res.data.data);
    } catch (err) {
      setFetchError(err.response?.data?.message ?? 'Member not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMember(); }, [id]); // eslint-disable-line

  const onEditSave = () => { setShowEdit(false); loadMember(); };
  const onDeleteConfirm = () => navigate('/members', { replace: true });

  /* ── Loading ──────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="member-detail member-detail--state">
        <div className="member-detail__spinner" />
        <p>Loading member…</p>
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────── */
  if (fetchError || !member) {
    return (
      <div className="member-detail member-detail--state">
        <p className="member-detail__error">{fetchError ?? 'Member not found'}</p>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/members')}>
          <BackIcon /> Back to Members
        </button>
      </div>
    );
  }

  const fullName = `${member.FirstName} ${member.LastName}`;
  const initials = `${member.FirstName?.charAt(0) ?? ''}${member.LastName?.charAt(0) ?? ''}`.toUpperCase();

  return (
    <div className="member-detail">

      {/* Breadcrumb */}
      <div className="member-detail__breadcrumb">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/members')}>
          <BackIcon /> Members
        </button>
        <span className="member-detail__sep">/</span>
        <span className="member-detail__current">{fullName}</span>
      </div>

      {/* Header card */}
      <div className="member-detail__header-card">
        <div className="member-detail__avatar">{initials}</div>

        <div className="member-detail__header-info">
          <h1 className="member-detail__name">{fullName}</h1>
          <div className="member-detail__meta">
            {member.LifeGroupName && (
              <span className="member-detail__meta-item">
                <ChurchIcon /> {member.LifeGroupName}
                {member.UnitName && ` · ${member.UnitName}`}
              </span>
            )}
            {member.Role && (
              <span className="badge-role">{getRoleLabel(member.Role)}</span>
            )}
            <span className={`badge ${membershipBadgeClass(member.MembershipType)}`}>
              {member.MembershipType}
            </span>
          </div>
        </div>

        <div className="member-detail__header-actions">
          {canEdit && (
            <button className="btn btn--ghost btn--sm" onClick={() => setShowEdit(true)}>
              <EditIcon /> Edit
            </button>
          )}
          {canResetPassword(role, member.Role) && (
            <button className="btn btn--ghost btn--sm" onClick={() => setShowResetPwd(true)}>
              🔑 {member.UserID ? 'Reset Password' : 'Set Password'}
            </button>
          )}
          {(canDelete || (canManage && canDeactivateMember(role) && Boolean(member.MembershipIsActive))) && (
            <div className="member-detail__danger-actions">
              {canManage && canDeactivateMember(role) && Boolean(member.MembershipIsActive) && (
                <button className="btn btn--danger-ghost btn--sm" onClick={() => setShowDeactivate(true)}>
                  Inactivate
                </button>
              )}
              {canDelete && (
                <button className="btn btn--danger-ghost btn--sm" onClick={() => setShowDelete(true)}>
                  <TrashIcon /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail cards flow into columns at their natural height. */}
      <div className="member-detail__grid member-detail__grid--compact">

        {/* Personal */}
        <section className="detail-card">
          <h2 className="detail-card__title">
            <UserIcon /> Personal Information
          </h2>
          <dl className="detail-card__body">
            <DetailRow label="First Name"     value={member.FirstName} />
            <DetailRow label="Last Name"      value={member.LastName} />
            <DetailRow label="Gender"         value={member.Gender} />
            <DetailRow label="Date of Birth"  value={fmt(member.BirthDate)} />
            <DetailRow label="Marital Status" value={member.MaritalStatus} />
            <DetailRow label="Email"          value={member.Email} />
          </dl>
        </section>

        {/* Membership */}
        <section className="detail-card">
          <h2 className="detail-card__title">
            <ChurchIcon /> Membership
          </h2>
          <dl className="detail-card__body">
            <DetailRow label="Membership Type" value={member.MembershipType} />
            {member.MembershipType && member.MembershipType !== 'Member' && canViewBelieverStatus && (
              <DetailRow label="Believer Status" value={member.BelieverStatus} />
            )}
            <DetailRow label="Join Date"       value={fmt(member.JoinDate)} />
            <DetailRow label="Member Since"    value={fmt(member.MemberSince)} />
            <DetailRow label="Account Role"    value={getRoleLabel(member.Role)} />
            <DetailRow label="Life Group"      value={member.LifeGroupName} />
            <DetailRow label="Unit"            value={member.UnitName} />
            <DetailRow label="Subdistrict"     value={member.SubdistrictName} />
          </dl>
        </section>

        {/* Member engagement */}
        <section className="detail-card">
          <h2 className="detail-card__title">
            <ChurchIcon /> Member Engagement
          </h2>
          <dl className="detail-card__body">
            <DetailRow
              label="Status"
              value={member.IsActiveEngage ? 'Active' : 'Inactive'}
            />
            <DetailRow label="Life Group" value={member.IsActiveLifeGroup ? 'Active' : 'Inactive'} />
            <DetailRow label="Sunday Service" value={member.IsActiveSundayService ? 'Active' : 'Inactive'} />
            <DetailRow label="Serving" value={member.IsActiveServing ? 'Active' : 'Inactive'} />
          </dl>
        </section>

        {/* Address */}
        <section className="detail-card">
          <h2 className="detail-card__title">
            <HomeIcon /> Address
          </h2>
          <dl className="detail-card__body">
            <DetailRow label="Street"      value={member.StreetAddress} />
            <DetailRow label="City"        value={member.City} />
            <DetailRow label="State"       value={member.State} />
            <DetailRow label="Postal Code" value={member.PostalCode} />
            <DetailRow label="Country"     value={member.Country} />
          </dl>
        </section>

        {/* Baptism */}
        <section className="detail-card">
          <h2 className="detail-card__title">
            <WaterIcon /> Baptism
          </h2>
          <dl className="detail-card__body">
            <DetailRow label="Baptized"      value={member.isBaptized ? 'Yes' : 'No'} />
            <DetailRow label="Date"          value={fmt(member.BaptismDate)} />
            <DetailRow label="Venue"         value={member.BaptismVenue} />
            <DetailRow label="Remarks"       value={member.BaptismRemarks} />
          </dl>
        </section>

        {/* Contact */}
        <section className="detail-card">
          <h2 className="detail-card__title">
            <PhoneIcon /> Contact
          </h2>
          <dl className="detail-card__body">
            <DetailRow label="Mobile"   value={member.MobileNumber} />
            <DetailRow label="Landline" value={member.LandlineNumber} />
            <DetailRow label="Email"    value={member.Email} />
          </dl>
        </section>

        {/* Membership status */}
        <section className="detail-card">
          <h2 className="detail-card__title">
            <ChurchIcon /> Membership Status
          </h2>
          <dl className="detail-card__body">
            <DetailRow
              label="Status"
              value={member.MembershipIsActive ? 'Active' : 'Inactive'}
            />
            {!member.MembershipIsActive && (
              <>
                <DetailRow label="Inactive Reason" value={member.InactiveReason} />
                <DetailRow label="Notes" value={member.InactiveNotes} />
              </>
            )}
          </dl>
        </section>

      </div>

      {/* Modals */}
      {showDeactivate && (
        <DeactivateMemberModal
          member={member}
          onClose={() => setShowDeactivate(false)}
          onSuccess={loadMember}
        />
      )}
      {showEdit && (
        <MemberFormModal
          member={member}
          onClose={() => setShowEdit(false)}
          onSave={onEditSave}
        />
      )}

      {showDelete && (
        <MemberDeleteModal
          member={member}
          onClose={() => setShowDelete(false)}
          onConfirm={onDeleteConfirm}
        />
      )}

      {showResetPwd && (
        <ResetPasswordModal
          member={member}
          onClose={() => setShowResetPwd(false)}
          onSave={() => { setShowResetPwd(false); loadMember(); }}
        />
      )}

    </div>
  );
};

export default MemberDetailPage;
