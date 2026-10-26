import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import dashboardService from '../../services/dashboardService';
import authService from '../../services/authService';
import MemberFormModal from '../../components/members/MemberFormModal';
import ResetPasswordModal from '../../components/members/ResetPasswordModal';
import { ROLES, getRoleLabel, canSelfEdit } from '../../permissions';
import {
  UserIcon, PhoneIcon, HomeIcon, WaterIcon, ChurchIcon, EditIcon,
} from '../../components/icons';
import { BAR_COLORS } from '../../utils/chartColors';
import AgeBarChart from '../../components/analytics/AgeBarChart';
import AttendanceModal from '../../components/dashboard/AttendanceModal';
import './Dashboard.css';
import '../members/MemberDetail.css';

const BREAKDOWN_COLORS = BAR_COLORS;

/* ── Date formatter — no time ───────────────────────────────── */
const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

/* ── StatCard ───────────────────────────────────────────────── */
const StatCard = ({ label, value, variant = '' }) => (
  <div className={`stat-card stat-card--${variant}`}>
    <span className="stat-card__label">{label}</span>
    <span className="stat-card__value">{value ?? '—'}</span>
  </div>
);

/* ── DonutChart ─────────────────────────────────────────────── */
const DonutChart = ({ data, total }) => {
  const female    = data.find(d => d.Gender === 'Female')?.count ?? 0;
  const male      = data.find(d => d.Gender === 'Male')?.count   ?? 0;
  const femalePct = total > 0 ? Math.round((female / total) * 100) : 0;
  const malePct   = total > 0 ? Math.round((male   / total) * 100) : 0;
  const CIRC      = 100.53;
  const isEmpty   = total <= 0;
  const baseColor = isEmpty ? '#e5e7eb' : '#e07a9a';
  const fillColor = isEmpty ? '#e5e7eb' : '#5b85b8';
  const femaleArc = total > 0 ? (female / total) * CIRC : 0;
  const legendFemaleColor = '#e07a9a';
  const legendMaleColor = '#5b85b8';

  return (
    <div className="donut-wrap">
      <div className="donut-svg-wrap">
        <svg width="144" height="144" viewBox="0 0 36 36" className="donut-svg">
          <circle cx="18" cy="18" r="16" fill="none" stroke={baseColor} strokeWidth="4" />
          <circle cx="18" cy="18" r="16" fill="none" stroke={fillColor} strokeWidth="4"
            strokeDasharray={`${femaleArc} ${CIRC}`} strokeLinecap="round"
            className="donut-chart__arc"
          />
        </svg>
        <div className="donut-centre">
          <span className="donut-centre__label">Total</span>
          <span className="donut-centre__value">{total.toLocaleString()}</span>
        </div>
      </div>
      <div className="donut-legend">
        <div className="donut-legend__item">
          <div className="donut-legend__dot" style={{ background: legendFemaleColor }} />
          <div className="donut-legend__info">
            <span className="donut-legend__key">Female</span>
            <span className="donut-legend__val">{femalePct}% ({female.toLocaleString()})</span>
          </div>
        </div>
        <div className="donut-legend__item">
          <div className="donut-legend__dot" style={{ background: legendMaleColor }} />
          <div className="donut-legend__info">
            <span className="donut-legend__key">Male</span>
            <span className="donut-legend__val">{malePct}% ({male.toLocaleString()})</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── HorizontalBarChart ─────────────────────────────────────── */
const HBarChart = ({ data, colorSet = BREAKDOWN_COLORS }) => {
  const max = Math.max(...data.map(d => Number(d.count)), 1);
  return (
    <div className="hbar-chart">
      {data.map((row, i) => {
        const count = Number(row.count);
        const pct   = Math.round((count / max) * 100);
        return (
          <div key={row.name ?? i} className="hbar-chart__row">
            <div className="hbar-chart__meta">
              <span className="hbar-chart__name">{row.name}</span>
              <span className="hbar-chart__count">{count.toLocaleString()}</span>
            </div>
            <div className="hbar-chart__track">
              <div className="hbar-chart__fill"
                style={{ width: `${pct}%`, background: colorSet[i % colorSet.length] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const QuickActionButton = ({ icon, label, onClick, primary = false }) => (
  <button
    className={`btn qa-btn${primary ? ' btn--primary' : ''}`}
    onClick={onClick}
  >
    <span className="qa-btn__left">
      <span className="material-symbols-outlined">{icon}</span>
      {label}
    </span>

    <span className="material-symbols-outlined">chevron_right</span>
  </button>
);

const QuickActions = ({ role, navigate, onRecordAttendance }) => {
  const actions = [
    {
      label: 'Record Sunday Attendance',
      icon: 'how_to_reg',
      onClick: onRecordAttendance,
      show: [ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER].includes(role),
    },
    {
      label: 'Add Member',
      icon: 'person_add',
      onClick: () => navigate('/members?action=add'),
      show: [
        ROLES.MASTER_ADMIN, ROLES.ADMIN,
        ROLES.MANAGER,
        ROLES.SUBDISTRICT_LEADER,
        ROLES.UNIT_LEADER,
        ROLES.ASSISTANT_UNIT_LEADER,
        ROLES.LG_LEADER,
        ROLES.ASSISTANT_LG_LEADER,
      ].includes(role),
    },
    {
      label: 'Add Subdistrict',
      icon: 'domain_add',
      onClick: () => navigate('/subdistricts?action=add'),
      show: [ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER].includes(role),
    },
    {
      label: 'Send Email',
      icon: 'mail',
      onClick: () => navigate('/communication?action=compose'),
      show: [ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.MANAGER].includes(role),
    },
    {
      label: 'Add Unit',
      icon: 'add_business',
      onClick: () => navigate('/units?action=add'),
      show: role === ROLES.SUBDISTRICT_LEADER,
    },
    {
      label: 'Add Group',
      icon: 'group_add',
      onClick: () => navigate('/groups?action=add'),
      show: [ROLES.SUBDISTRICT_LEADER, ROLES.UNIT_LEADER, ROLES.ASSISTANT_UNIT_LEADER].includes(role),
    },
    {
      label: 'Inactivate Member',
      icon: 'person_off',
      onClick: () => navigate('/inactive-members?action=deactivate'),
      show: [
        ROLES.ASSISTANT_LG_LEADER,
        ROLES.UNIT_LEADER,
        ROLES.ASSISTANT_UNIT_LEADER,
      ].includes(role),
    },
  ].filter((action) => action.show);

  if (actions.length === 0) return null;

  return (
    <div className="quick-actions">
      <h4 className="quick-actions__title">Quick Actions</h4>

      {actions.map((action, index) => (
        <QuickActionButton
          key={action.label}
          {...action}
          primary={index === 0}
        />
      ))}
    </div>
  );
};

/* ── breakdown chart title per role ────────────────────────── */
const breakdownTitle = (role) => {
  if (role === ROLES.MASTER_ADMIN || role === ROLES.ADMIN || role === ROLES.MANAGER) return 'Members by Subdistrict';
  if (role === ROLES.SUBDISTRICT_LEADER)              return 'Members by Unit';
  if (role === ROLES.UNIT_LEADER || role === ROLES.ASSISTANT_UNIT_LEADER) return 'Members by Group';
  return 'Membership Composition';
};

/* ── Skeleton loader ────────────────────────────────────────── */
const SkeletonDashboard = () => (
  <div className="dashboard">
    <div className="skeleton skeleton--page-title"  />
    <div className="dashboard__summary">
      {[1,2,3].map(i => (
        <div key={i} className="stat-card">
          <div className="skeleton skeleton--stat-label"  />
          <div className="skeleton skeleton--stat-value"  />
        </div>
      ))}
    </div>
    <div className="dashboard__charts">
      <div className="chart-card"><div className="skeleton skeleton--chart"  /></div>
      <div className="chart-card"><div className="skeleton skeleton--chart"  /></div>
    </div>
  </div>
);

/* ── DetailRow — reuse MemberDetailPage style ───────────────── */
const DetailRow = ({ label, value }) => (
  <div className="detail-row">
    <dt className="detail-row__label">{label}</dt>
    <dd className="detail-row__value">{value || '—'}</dd>
  </div>
);

/* ── membership badge class ─────────────────────────────────── */
const membershipBadgeClass = (type) => {
  const key = (type ?? '').toLowerCase();
  if (key === 'consistent visitor') return 'badge--consistent-visitor';
  if (key === 'visitor')            return 'badge--visitor';
  return 'badge--member';
};

const ProfileView = ({ profile, user, showEdit, setShowEdit, onSaved }) => {
  const [showChangePwd, setShowChangePwd] = useState(false);

  if (!profile) return <div className="dashboard__error">Profile not available.</div>;

  const fullName = `${profile.FirstName || ''} ${profile.LastName || ''}`.trim();
  const initials = `${profile.FirstName?.[0] ?? ''}${profile.LastName?.[0] ?? ''}`.toUpperCase() || 'ME';
  const isSelf   = Number(profile.MemberID) === Number(user?.memberId);

  return (
    <div className="member-detail">
      <h2 className="dashboard__title dashboard__title--profile" >My Profile</h2>

      {/* Header card */}
      <div className="member-detail__header-card">
        <div className="member-detail__avatar">{initials}</div>
        <div className="member-detail__header-info">
          <h1 className="member-detail__name">{fullName || 'My Profile'}</h1>
          <div className="member-detail__meta">
            {profile.LifeGroupName && (
              <span className="member-detail__meta-item">
                <ChurchIcon /> {profile.LifeGroupName}
                {profile.UnitName && ` · ${profile.UnitName}`}
              </span>
            )}
            {profile.Role && (
              <span className="badge-role">{getRoleLabel(profile.Role)}</span>
            )}
            <span className={`badge ${membershipBadgeClass(profile.MembershipType)}`}>
              {profile.MembershipType || 'Member'}
            </span>
          </div>
        </div>
        <div className="member-detail__header-actions">
          {canSelfEdit(user?.role, isSelf) && (
            <button className="btn btn--ghost btn--sm" onClick={() => setShowEdit(true)}>
              <EditIcon /> Edit
            </button>
          )}
          <button className="btn btn--ghost btn--sm" onClick={() => setShowChangePwd(true)}>
            🔑 Change Password
          </button>
        </div>
      </div>

      {/* Detail sections grid */}
      <div className="member-detail__grid">

        <section className="detail-card">
          <h2 className="detail-card__title"><UserIcon /> Personal Information</h2>
          <dl className="detail-card__body">
            <DetailRow label="First Name"     value={profile.FirstName} />
            <DetailRow label="Last Name"      value={profile.LastName} />
            <DetailRow label="Gender"         value={profile.Gender} />
            <DetailRow label="Date of Birth"  value={fmt(profile.BirthDate)} />
            <DetailRow label="Marital Status" value={profile.MaritalStatus} />
            <DetailRow label="Email"          value={profile.Email} />
          </dl>
        </section>

        <section className="detail-card">
          <h2 className="detail-card__title"><ChurchIcon /> Membership</h2>
          <dl className="detail-card__body">
            <DetailRow label="Membership Type" value={profile.MembershipType} />
            <DetailRow label="Join Date"        value={fmt(profile.JoinDate)} />
            <DetailRow label="Member Since"     value={fmt(profile.MemberSince)} />
            <DetailRow label="Life Group"       value={profile.LifeGroupName} />
            <DetailRow label="Unit"             value={profile.UnitName} />
          </dl>
        </section>

        <section className="detail-card">
          <h2 className="detail-card__title"><HomeIcon /> Address</h2>
          <dl className="detail-card__body">
            <DetailRow label="Street"      value={profile.StreetAddress} />
            <DetailRow label="City"        value={profile.City} />
            <DetailRow label="State"       value={profile.State} />
            <DetailRow label="Postal Code" value={profile.PostalCode} />
            <DetailRow label="Country"     value={profile.Country} />
          </dl>
        </section>

        <section className="detail-card">
          <h2 className="detail-card__title"><WaterIcon /> Baptism</h2>
          <dl className="detail-card__body">
            <DetailRow label="Baptized" value={profile.isBaptized ? 'Yes' : 'No'} />
            <DetailRow label="Date"     value={fmt(profile.BaptismDate)} />
            <DetailRow label="Venue"    value={profile.BaptismVenue} />
            <DetailRow label="Remarks"  value={profile.BaptismRemarks} />
          </dl>
        </section>

        <section className="detail-card">
          <h2 className="detail-card__title"><PhoneIcon /> Contact</h2>
          <dl className="detail-card__body">
            <DetailRow label="Mobile"   value={profile.MobileNumber} />
            <DetailRow label="Landline" value={profile.LandlineNumber} />
            <DetailRow label="Email"    value={profile.Email} />
          </dl>
        </section>

      </div>

      {showEdit && (
        <MemberFormModal
          member={{
            ...profile,
            MemberID: profile.MemberID ?? user?.memberId,
          }}
          onClose={() => setShowEdit(false)}
          onSave={onSaved}
        />
      )}

      {showChangePwd && (
        <ResetPasswordModal
          member={{ ...profile, MemberID: profile.MemberID ?? user?.memberId }}
          onClose={() => setShowChangePwd(false)}
          onSave={() => setShowChangePwd(false)}
          isSelf
        />
      )}
    </div>
  );
};

/* ── normalise /auth/me response to profile shape ───────────── */
const normaliseMe = (raw, user) => ({
  FirstName:      raw.FirstName,
  LastName:       raw.LastName,
  Email:          raw.Email,
  Gender:         raw.Gender,
  BirthDate:      raw.BirthDate,
  MaritalStatus:  raw.MaritalStatus,
  MembershipType: raw.MembershipType,
  BelieverStatus: raw.BelieverStatus,
  JoinDate:       raw.JoinDate,
  MemberSince:    raw.MemberSince,
  MobileNumber:   raw.MobileNumber,
  LandlineNumber: raw.LandlineNumber,
  LifeGroupName:  raw.LifeGroupName,
  UnitName:       raw.UnitName,
  StreetAddress:  raw.StreetAddress,
  City:           raw.City,
  State:          raw.State,
  PostalCode:     raw.PostalCode,
  Country:        raw.Country,
  isBaptized:     raw.isBaptized,
  BaptismDate:    raw.BaptismDate,
  BaptismVenue:   raw.BaptismVenue,
  BaptismRemarks: raw.BaptismRemarks,
  Role:           raw.Role ?? user?.role,
  MemberID:       raw.MemberID ?? user?.memberId,
  LifeGroupID:    raw.LifeGroupID,
});

/* ── DashboardPage ──────────────────────────────────────────── */
const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);

  const userRole = user?.role;
  const userMemberId = user?.memberId;

  const isProfileOnly = [ROLES.CORE_TEAM, ROLES.MEMBER].includes(userRole);

  const reloadProfile = async () => {
    const res = await authService.getMe();
    const raw = res?.data ?? res;
    setProfile(normaliseMe(raw, user));
  };

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setErr(null);

    const load = isProfileOnly
      ? authService.getMe().then(res => {
          const raw = res?.data ?? res;
          return normaliseMe(raw, {
            role: userRole,
            memberId: userMemberId,
          });
        })
      : dashboardService.getDashboard().then(
          res => res.data?.data ?? res.data
        );

    load
      .then(result => {
        if (!cancelled) {
          if (isProfileOnly) setProfile(result);
          else setData(result);
        }
      })
      .catch(e => {
        if (!cancelled) {
          setErr(
            e.response?.data?.message ??
            e.message ??
            'Failed to load'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isProfileOnly, userMemberId, userRole]);

  if (loading) return <SkeletonDashboard />;
  if (err)     return <div className="dashboard__error">{err}</div>;

  /* ── Profile view ── */
  if (isProfileOnly) {
    return (
      <ProfileView
        profile={profile}
        user={user}
        showEdit={showEdit}
        setShowEdit={setShowEdit}
        onSaved={async () => {
          setShowEdit(false);
          try { await reloadProfile(); } catch {
            // Preserve the current profile if refreshing after a save fails.
          }
        }}
      />
    );
  }

  /* ── Full analytics dashboard ── */
  if (!data) return null;

  const role  = user?.role;
  const { summary, gender, age, composition, breakdown } = data;
  const structure = data.structure ?? {};
  const total  = Number(summary?.totalMembers ?? 0);
  const active = Number(summary?.activeMembers ?? 0);
  const inactive = Number(summary?.inactiveMembers ?? 0);

  const breakdownData = breakdown?.length
    ? breakdown
    : composition?.map(c => ({ name: c.type, count: c.count })) ?? [];

  const cards = [
    { label: 'Total Active Members',   value: active.toLocaleString(),               variant: '' },
    { label: 'Total Inactive Members', value: inactive.toLocaleString(),              variant: 'secondary' },
    { label: 'New Members',    value: Number(summary.newMembers).toLocaleString(), variant: 'tertiary' },
  ];
  if (structure.totalGroups       != null) cards.push({ label: 'Total Groups',       value: Number(structure.totalGroups).toLocaleString(),       variant: 'muted' });
  if (structure.totalUnits        != null) cards.push({ label: 'Total Units',        value: Number(structure.totalUnits).toLocaleString(),        variant: 'muted' });
  if (structure.totalSubdistricts != null) cards.push({ label: 'Total Subdistricts', value: Number(structure.totalSubdistricts).toLocaleString(), variant: 'muted' });

  const pageTitle = {
    [ROLES.MASTER_ADMIN]:        'Church Overview',
    [ROLES.ADMIN]:               'Church Overview',
    [ROLES.MANAGER]:             'Church Overview',
    [ROLES.SUBDISTRICT_LEADER]:  'Subdistrict Overview',
    [ROLES.UNIT_LEADER]:         'Unit Overview',
    [ROLES.ASSISTANT_UNIT_LEADER]: 'Unit Overview',
    [ROLES.LG_LEADER]:           'Group Overview',
    [ROLES.ASSISTANT_LG_LEADER]: 'Group Overview',
  }[role] ?? 'Dashboard';

  return (
    <div className="dashboard">
      <h2 className="dashboard__title">{pageTitle}</h2>
      <div className="dashboard__summary" style={{ '--card-count': cards.length }}>
        {cards.map((c, i) => <StatCard key={i} {...c} />)}
      </div>
      <div className="dashboard__bottom">
        <div className="chart-card">
          <h4 className="chart-card__title">{breakdownTitle(role)}</h4>
          {breakdownData.length > 0
            ? <HBarChart data={breakdownData} />
            : <p className="dashboard__empty">No data available.</p>
          }
        </div>
        <QuickActions role={role} navigate={navigate} onRecordAttendance={() => setShowAttendance(true)} />
      </div>
      <div className="dashboard__charts">
        <div className="chart-card">
          <h4 className="chart-card__title">Age Distribution</h4>
          <AgeBarChart data={age ?? []} />
        </div>
        <div className="chart-card">
          <h4 className="chart-card__title">Gender Distribution</h4>
          <DonutChart data={gender ?? []} total={total} />
        </div>
      </div>
      {showAttendance && (
        <AttendanceModal
          onClose={() => setShowAttendance(false)}
          onSaved={() => setShowAttendance(false)}
        />
      )}
    </div>
  );
};

export default DashboardPage;
