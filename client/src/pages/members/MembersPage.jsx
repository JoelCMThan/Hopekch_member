import exportCsv from '../../utils/exportCsv';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import memberService from '../../services/memberService';
import {
  canCreateMember,
  canBulkImportMembers,
  canEditMember,
  canSelfEdit,
  canDeleteMember,
  canSeeUnitFilter,
  canSeeLifeGroupFilter,
  getVisibleRoleOptions,
  getRoleLabel,
} from '../../permissions';
import MemberFormModal from '../../components/members/MemberFormModal';
import MemberDeleteModal from '../../components/members/MemberDeleteModal';
import BulkImportModal from '../../components/members/BulkImportModal';
import './Members.css';

const MEMBERSHIP_TYPES = ['Member', 'Visitor', 'Consistent Visitor'];
const PAGE_SIZE = 15;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const BADGE_CLASS = {
  member: 'badge--member',
  visitor: 'badge--visitor',
  'consistent visitor': 'badge--consistent-visitor',
};


const ROLE_BADGE_CLASS = {
  member: 'role--member',
  core_team: 'role--core-team',
  assistantlg_leader: 'role--assistantlg-leader',
  lg_leader: 'role--lg-leader',
  unit_leader: 'role--unit-leader',
  assistantunit_leader: 'role--assistantunit-leader',
  subdistrict_leader: 'role--subdistrict-leader',
  master_admin: 'role--admin',
  admin: 'role--admin',
  manager: 'role--manager',
};

const MembersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role;

  const canCreate = canCreateMember(role);
  const canBulkImport = canBulkImportMembers(role);
  const canEdit = canEditMember(role);
  const canDelete = canDeleteMember(role);
  const showUnitFilter = canSeeUnitFilter(role);
  const showLGFilter = canSeeLifeGroupFilter(role);

  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [search, setSearch] = useState('');
  const [membershipType, setMembershipType] = useState('');
  const [membershipStatus, setMembershipStatus] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [subdistrictId, setSubdistrictId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [lifeGroupId, setLifeGroupId] = useState('');

  const [subdistricts, setSubdistricts] = useState([]);
  const [allUnits, setAllUnits] = useState([]);
  const [lifeGroups, setLifeGroups] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Auto-open add modal when navigated here with ?action=add
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'add' && canCreate) {
      setEditTarget(null);
      setShowForm(true);
      // Clean the URL so refreshing doesn't re-trigger it
      navigate('/members', { replace: true });
    }
  }, [location.search, canCreate, navigate]);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const getFilters = useCallback(() => ({
        search: search || undefined,
        membershipType: membershipType || undefined,
        membershipStatus: membershipStatus || undefined,
        role: roleFilter || undefined,
        subdistrictId: subdistrictId || undefined,
        unitId: unitId || undefined,
        lifeGroupId: lifeGroupId || undefined,
  }), [search, membershipType, membershipStatus, roleFilter, subdistrictId, unitId, lifeGroupId]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const res = await memberService.getMembers({
        ...getFilters(),
        page,
        limit: PAGE_SIZE,
      });

      const data = res.data.data;

      setMembers(data.members ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setFetchError(err.response?.data?.message ?? 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [getFilters, page]);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await memberService.getMembers({ ...getFilters(), export: true });
      const data = res.data?.data ?? res.data;
      exportCsv('members.csv', [
        { label: 'First Name', value: m => m.FirstName },
        { label: 'Last Name', value: m => m.LastName },
        { label: 'Gender', value: m => m.Gender },
        { label: 'Email', value: m => m.Email },
        { label: 'Mobile', value: m => m.MobileNumber },
        ...(showLGFilter ? [{ label: 'Life Group', value: m => m.LifeGroupName }] : []),
        ...(showUnitFilter ? [
          { label: 'Unit', value: m => m.UnitName },
          { label: 'Subdistrict', value: m => m.SubdistrictName },
        ] : []),
        { label: 'Membership', value: m => m.MembershipType },
        { label: 'Role', value: m => getRoleLabel(m.Role) ?? 'No account' },
        { label: 'Join Date', value: m => m.JoinDate ? fmtDate(m.JoinDate) : '' },
        { label: 'Member Since', value: m => m.MemberSince ? fmtDate(m.MemberSince) : '' },
      ], data.members ?? []);
    } catch (err) {
      setExportError(err.response?.data?.message ?? 'Failed to export members');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  useEffect(() => {
    if (!showUnitFilter) return;

    Promise.all([
      memberService.getSubdistricts().then((r) => r.data.data ?? []),
      memberService.getUnits().then((r) => r.data.data ?? []),
    ])
      .then(([subdistrictData, unitData]) => {
        setSubdistricts(subdistrictData);
        setAllUnits(unitData);
      })
      .catch(() => {});
  }, [showUnitFilter]);

  const units = subdistrictId
  ? allUnits.filter(
      (u) => String(u.SubdistrictID) === String(subdistrictId)
    )
  : allUnits;
  
  useEffect(() => {
    if (!showLGFilter) return;
    memberService.getLifeGroups(unitId || undefined, subdistrictId || undefined)
      .then(r => setLifeGroups(r.data.data ?? []))
      .catch(() => {});
  }, [showLGFilter, subdistrictId, unitId]);

  const mkFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const handleSubdistrictFilter = (e) => {
    setSubdistrictId(e.target.value);
    setUnitId('');
    setLifeGroupId('');
    setPage(1);
  };

  const handleUnitFilter = (e) => {
    const value = e.target.value;
    const selectedUnit = allUnits.find((unit) => String(unit.UnitID) === String(value));

    setUnitId(value);
    if (value) {
      setSubdistrictId(selectedUnit?.SubdistrictID ? String(selectedUnit.SubdistrictID) : '');
    }
    setLifeGroupId('');
    setPage(1);
  };

  const handleLifeGroupFilter = (e) => {
    const value = e.target.value;
    const selectedGroup = lifeGroups.find((group) => String(group.LifeGroupID) === String(value));

    setLifeGroupId(value);
    if (selectedGroup) {
      setSubdistrictId(selectedGroup.SubdistrictID ? String(selectedGroup.SubdistrictID) : '');
      setUnitId(selectedGroup.UnitID ? String(selectedGroup.UnitID) : '');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setMembershipType('');
    setMembershipStatus('');
    setRoleFilter('');
    setSubdistrictId('');
    setUnitId('');
    setLifeGroupId('');
    setPage(1);
  };

  const openNew = () => { setEditTarget(null); setShowForm(true); };
  const openEdit = async (m) => {
    try {
      const response = await memberService.getMember(m.MemberID);
      setEditTarget(response.data.data);
      setShowForm(true);
    } catch (err) {
      setFetchError(err.response?.data?.message || 'Unable to load member details for editing.');
    }
  };
  const openDel = (m) => { setDelTarget(m); };

  const onSaved = () => { setShowForm(false); setEditTarget(null); fetchMembers(); };
  const onDelDone = () => { setDelTarget(null); fetchMembers(); };

  const colSpan = 9 + (showLGFilter ? 1 : 0) + (showUnitFilter ? 2 : 0);

  return (
    <div className="mp">

      <div className="mp__header">
        <div>
          <h2 className="mp__title">Member Management</h2>
          <p className="mp__subtitle">Manage and monitor your church community records.</p>
        </div>

        <div className="mp__header-actions">
          {canBulkImport && (
            <button className="btn btn--ghost btn--md" onClick={() => setShowBulkImport(true)}>
              <span className="material-symbols-outlined" aria-hidden="true">upload_file</span>
              Import
            </button>
          )}
          {canCreate && <button className="btn btn--primary btn--md" onClick={openNew}>+ Add Member</button>}
        </div>
      </div>

      <div className="list-export-toolbar">
        <div className="mp__filters">
          <div className="mp__filter-search">
            <input
              type="text"
              placeholder="Search by name or email"
              value={search}
              onChange={mkFilter(setSearch)}
              className="mp__search-input"
            />
          </div>

          {showUnitFilter && (
            <>
              <select value={subdistrictId} onChange={handleSubdistrictFilter} className="mp__filter-select">
                <option value="">Subdistrict: All</option>
                {subdistricts.map(s => (
                  <option key={s.SubdistrictID} value={s.SubdistrictID}>{s.SubdistrictName}</option>
                ))}
              </select>

              <select value={unitId} onChange={handleUnitFilter} className="mp__filter-select">
                <option value="">Unit: All</option>
                {units.map(u => (
                  <option key={u.UnitID} value={u.UnitID}>{u.UnitName}</option>
                ))}
              </select>
            </>
          )}

          {showLGFilter && (
            <select value={lifeGroupId} onChange={handleLifeGroupFilter} className="mp__filter-select">
              <option value="">Life Group: All</option>
              {lifeGroups.map(g => (
                <option key={g.LifeGroupID} value={g.LifeGroupID}>{g.LifeGroupName}</option>
              ))}
            </select>
          )}

          <select value={membershipType} onChange={mkFilter(setMembershipType)} className="mp__filter-select">
            <option value="">Membership: All</option>
            {MEMBERSHIP_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select value={membershipStatus} onChange={mkFilter(setMembershipStatus)} className="mp__filter-select">
            <option value="">Status: All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select value={roleFilter} onChange={mkFilter(setRoleFilter)} className="mp__filter-select">
            <option value="">Role: All</option>
            {getVisibleRoleOptions(role).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <button type="button" className="mp__clear-btn" onClick={clearFilters} title="Clear filters">
          <span className="material-symbols-outlined">
            filter_alt_off
          </span>
          </button>

        </div>
        <button type="button" className="btn btn--ghost btn--md" onClick={handleExport} disabled={exporting} aria-label={exporting ? 'Exporting CSV' : 'Export CSV'} aria-busy={exporting} title="Export CSV">
          <span className="material-symbols-outlined" aria-hidden="true">{exporting ? 'hourglass_empty' : 'file_download'}</span>
          CSV
        </button>
      </div>

      {fetchError && <div className="mp__error">{fetchError}</div>}

      {/* FIXED SCROLL STRUCTURE */}
      {exportError && <div className="mp__error" role="alert">{exportError}</div>}

      <div className="mp__card">
        <div className="mp__table-header">
          <div>
            <h3 className="mp__section-title">
              All Members ({total})
            </h3>
            <p className="mp__section-note">
              Showing up to {PAGE_SIZE} members per page.
            </p>
          </div>
        </div>

        <div className="mp__table-wrap">

          <table className="mp__table">
            <thead>
              <tr>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Gender</th>
                <th>Email</th>
                <th>Mobile</th>
                {showLGFilter && <th>Life Group</th>}
                {showUnitFilter && <th>Unit</th>}
                {showUnitFilter && <th>Subdistrict</th>}
                <th>Membership</th>
                <th>Role</th>
                <th>Join Date</th>
                <th className="mp__th-actions">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="mp__state-cell">
                    Loading members…
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="mp__state-cell">
                    No members found
                  </td>
                </tr>
              ) : members.map((m, idx) => (
                <tr
                  key={m.MemberID}
                  className={`mp__row mp__row--clickable${idx % 2 ? ' mp__row--alt' : ''}`}
                  onClick={() => navigate(`/members/${m.MemberID}`)}
                  title="Click to view member"
                >
                  <td>{m.FirstName}</td>
                  <td>{m.LastName}</td>
                  <td>{m.Gender || '—'}</td>
                  <td>{m.Email}</td>
                  <td>{m.MobileNumber || '—'}</td>

                  {showLGFilter && <td>{m.LifeGroupName || '—'}</td>}
                  {showUnitFilter && <td>{m.UnitName || '—'}</td>}
                  {showUnitFilter && <td>{m.SubdistrictName || '—'}</td>}

                  <td>
                    <span className={`mp__badge ${BADGE_CLASS[(m.MembershipType || '').toLowerCase()] ?? 'badge--member'}`}>
                      {m.MembershipType || '—'}
                    </span>
                  </td>

                  <td>
                    <span className={`mp__role-badge ${ROLE_BADGE_CLASS[m.Role] ?? 'role--none'}`}>
                      {getRoleLabel(m.Role) ?? 'No account'}
                    </span>
                  </td>

                  <td>{fmtDate(m.JoinDate)}</td>

                  <td className="mp__actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="mp__action-group">

                      {(canEdit || canSelfEdit(role, m.MemberID === user.memberId)) && (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => openEdit(m)}>
                          Edit
                        </button>
                      )}

                      {canDelete && (
                        <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => openDel(m)}                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>

        </div>
      </div>

      {showForm && (
        <MemberFormModal
          member={editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
          onSave={onSaved}
        />
      )}

      {delTarget && (
        <MemberDeleteModal
          member={delTarget}
          onClose={() => setDelTarget(null)}
          onConfirm={onDelDone}
        />
      )}

      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onImported={fetchMembers}
        />
      )}

    </div>
  );
};

export default MembersPage;
