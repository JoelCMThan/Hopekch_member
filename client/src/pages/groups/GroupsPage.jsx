import exportCsv from '../../utils/exportCsv';
import '../members/MemberDetail.css';
import { getGroupSplitReason } from '../../utils/groupSplit';
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import {
  canAccessGroupsPage,
  canCreateGroup,
  canSplitGroup,
  canDeleteGroup,
  canSeeGroupUnitFilter,
} from '../../permissions/groups';
import groupService from '../../services/groupService';
import AddGroupModal from '../../components/groups/AddGroupModal';
import SplitGroupModal from '../../components/groups/SplitGroupModal';
import DeleteGroupModal from '../../components/groups/DeleteGroupModal';
import './Groups.css';

const PAGE_SIZE = 6;

const GroupsPage = () => {
  const { user } = useAuth();
  const role = user?.role;

  const location = useLocation();
  const navigate = useNavigate();

  const canCreate    = canCreateGroup(role);
  const canSplit     = canSplitGroup(role);
  const canDelete = canDeleteGroup(role);
  const showUnitFilter = canSeeGroupUnitFilter(role);

  const [groups, setGroups]         = useState([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [search, setSearch]              = useState('');
  const [subdistrictFilter, setSubdistrictFilter] = useState('');
  const [unitFilter, setUnitFilter]      = useState('');
  const [subdistricts, setSubdistricts]   = useState([]);
  const [allUnits, setAllUnits]          = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [splitTarget, setSplitTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');

    if (action === 'add' && canCreate) {
      setShowAddModal(true);
      navigate('/groups', { replace: true });
    }

  }, [location.search, canCreate, navigate]);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const getFilters = useCallback(() => ({
        search: search || undefined,
        subdistrictId: subdistrictFilter || undefined,
        unitId: unitFilter || undefined,
  }), [search, subdistrictFilter, unitFilter]);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await groupService.getGroups({
        ...getFilters(),
        page,
        limit: PAGE_SIZE,
      });
      const data = res.data?.data ?? res.data;
      setGroups(data.groups ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? Math.ceil((data.total ?? 0) / PAGE_SIZE));
    } catch (err) {
      setFetchError(err.response?.data?.message ?? 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [getFilters, page]);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await groupService.getGroups({ ...getFilters(), export: true });
      const data = res.data?.data ?? res.data;
      exportCsv('groups.csv', [
        { label: 'Life Group Name', value: row => row.LifeGroupName },
        { label: 'Subdistrict', value: row => row.SubdistrictName },
        { label: 'Unit', value: row => row.UnitName },
        { label: 'Members', value: row => row.MemberCount ?? 0 },
        { label: 'Leaders', value: row => row.LeaderNames },
        { label: 'Assistant Leaders', value: row => row.AssistantLeaderNames },
        { label: 'Status', value: row => Number(row.IsActive) ? 'Active' : 'Inactive' },
      ], data.groups ?? []);
    } catch (err) {
      setExportError(err.response?.data?.message ?? 'Failed to export groups');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // Load lookup data for filter dropdowns
  useEffect(() => {
    if (!showUnitFilter) return;

    Promise.all([
      groupService.getSubdistricts().then((r) => r.data?.data ?? r.data ?? []),
      groupService.getUnits().then((r) => r.data?.data ?? r.data ?? []),
    ])
      .then(([subdistrictData, unitData]) => {
        setSubdistricts(subdistrictData);
        setAllUnits(unitData);
      })
      .catch(() => {});
  }, [showUnitFilter]);

  const units = subdistrictFilter
  ? allUnits.filter(
      (u) => String(u.SubdistrictID) === String(subdistrictFilter)
    )
  : allUnits;
  
  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };
  const handleSubdistrictFilter = (e) => {
    setSubdistrictFilter(e.target.value);
    setUnitFilter('');
    setPage(1);
  };
  const handleUnitFilter = (e) => {
    const value = e.target.value;
    const selectedUnit = allUnits.find((unit) => String(unit.UnitID) === String(value));

    setUnitFilter(value);
    if (value) {
      setSubdistrictFilter(selectedUnit?.SubdistrictID ? String(selectedUnit.SubdistrictID) : '');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setSubdistrictFilter('');
    setUnitFilter('');
    setPage(1);
  };

  const onGroupSaved = () => {
    setShowAddModal(false);
    fetchGroups();
  };


  const onGroupSplit = () => {
    setSplitTarget(null);
    fetchGroups();
  };

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return;

    try {
      await groupService.deleteGroup(deleteTarget.LifeGroupID);

      setDeleteTarget(null);
      fetchGroups();

    } catch (err) {
      setFetchError(
        err.response?.data?.message ?? 'Failed to delete group'
      );
    }
  };

  const pageNums = (() => {
    const start = Math.max(1, Math.min(totalPages - 4, page - 2));
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  })();

  if (!canAccessGroupsPage(role)) {
    return <div className="gp gp__empty">You do not have permission to view this page.</div>;
  }

  return (
    <div className="gp">
      <div className="gp__header">
        <div>
          <h1 className="gp__title">Life Group Management</h1>
          <p className="gp__subtitle">
            Track groups, assign leaders, and prepare split actions.
          </p>
        </div>

        {canCreate && (
          <button className="btn btn--primary btn--md" onClick={() => setShowAddModal(true)}>
            + Create Life Group
          </button>
        )}
      </div>

      <div className="list-export-toolbar">
        <section className="gp__controls">
          <div className="gp__control-search">
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder="Search groups..."
              className="gp__search-input"
            />
          </div>

          {showUnitFilter && (
            <>
              <select value={subdistrictFilter} onChange={handleSubdistrictFilter} className="gp__select">
                <option value="">Subdistrict: All</option>
                {subdistricts.map((s) => (
                  <option key={s.SubdistrictID} value={s.SubdistrictID}>{s.SubdistrictName}</option>
                ))}
              </select>

              <select value={unitFilter} onChange={handleUnitFilter} className="gp__select">
                <option value="">Unit: All</option>
                {units.map((u) => (
                  <option key={u.UnitID} value={u.UnitID}>{u.UnitName}</option>
                ))}
              </select>

              <button type="button" className="gp__clear-btn" onClick={clearFilters} title="Clear filters">
                <span className="material-symbols-outlined">
                  filter_alt_off
                </span>
              </button>
            </>
          )}
        </section>
        <button type="button" className="btn btn--ghost btn--md" onClick={handleExport} disabled={exporting} aria-label={exporting ? 'Exporting CSV' : 'Export CSV'} aria-busy={exporting} title="Export CSV">
          <span className="material-symbols-outlined" aria-hidden="true">{exporting ? 'hourglass_empty' : 'file_download'}</span>
          CSV
        </button>
      </div>

      {fetchError && <div className="gp__error">{fetchError}</div>}

      {exportError && <div className="gp__error" role="alert">{exportError}</div>}

      <div className="gp__table-card">
        <div className="gp__table-header">
          <div>
            <h2 className="gp__section-title">All Life Groups ({total})</h2>
            <p className="gp__section-note">Showing up to {PAGE_SIZE} life groups per page.</p>
          </div>
        </div>

        <div className="gp__table-wrap">
          <table className="gp__table">
            <thead>
              <tr>
                <th>Life Group Name</th>
                <th>Subdistrict</th>
                <th>Unit</th>
                <th>Members</th>
                <th>Leaders</th>
                <th>Assistant Leaders</th>
                <th>Status</th>
                <th className="gp__actions-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="gp__empty-state">Loading groups…</td></tr>
              ) : groups.length === 0 ? (
                <tr><td colSpan={8} className="gp__empty-state">No groups found.</td></tr>
              ) : (
                groups.map((group) => {
                  const leaderName = group.LeaderNames || 'Unassigned';
                  const initials = (group.LifeGroupName ?? '')
                    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

                  return (
                    <tr key={group.LifeGroupID} className="gp__row organization-row" tabIndex={0} onClick={() => navigate(`/groups/${group.LifeGroupID}`)} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); navigate(`/groups/${group.LifeGroupID}`); } }}>
                      <td>
                        <div className="gp__group-name">
                          <div className="gp__avatar">{initials}</div>
                          <span>{group.LifeGroupName}</span>
                        </div>
                      </td>
                      <td>{group.SubdistrictName || '—'}</td>
                      <td>{group.UnitName || '—'}</td>
                      <td className="gp__center-cell">{group.MemberCount ?? 0}</td>
                      <td className="organization-leaders">{leaderName}</td>
                      <td className="organization-leaders">{group.AssistantLeaderNames || 'Unassigned'}</td>
                      <td><span className={`organization-status organization-status--${Number(group.IsActive) ? 'active' : 'inactive'}`}>{Number(group.IsActive) ? 'Active' : 'Inactive'}</span></td>
                      <td className="gp__actions-cell" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                        <div className="gp__action-group">
                          {canSplit && (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              disabled={!Number(group.IsUsable)}
                              title={getGroupSplitReason(group) || undefined}
                              aria-label={getGroupSplitReason(group) || 'Split'}
                              onClick={() => setSplitTarget(group)}
                            >
                              Split
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="btn btn--danger-ghost btn--sm"
                              onClick={() => setDeleteTarget(group)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="gp__pagination">
            <span>Page {page} of {totalPages}</span>
            <div className="gp__pagination-buttons">
              <button
                className="gp__page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </button>
              {pageNums.map((n) => (
                <button
                  key={n}
                  className={`gp__page-btn${n === page ? ' gp__page-btn--active' : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                className="gp__page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddGroupModal
          onClose={() => setShowAddModal(false)}
          onSave={onGroupSaved}
        />
      )}


      {splitTarget && (
        <SplitGroupModal
          group={splitTarget}
          onClose={() => setSplitTarget(null)}
          onSplit={onGroupSplit}
        />
      )}

      {deleteTarget && (
        <DeleteGroupModal
          group={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteGroup}
        />
      )}
    </div>
  );
};

export default GroupsPage;
