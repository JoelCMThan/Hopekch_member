import exportCsv from '../../utils/exportCsv';
import { getHierarchySplitReason } from '../../utils/groupSplit';
import '../members/MemberDetail.css';
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

import {
  canAccessUnitsPage,
  canCreateUnit,
  canEditUnit,
  canDeleteUnit,
  canSeeUnitSubdistrictFilter
} from '../../permissions/units';

import unitService from '../../services/unitService';
import AddUnitModal from '../../components/units/AddUnitModal';
import DeleteUnitModal from '../../components/units/DeleteUnitModal';
import SplitHierarchyModal from '../../components/organization/SplitHierarchyModal';

import './Units.css';

const PAGE_SIZE = 6;

const UnitsPage = () => {
  const { user } = useAuth();
  const role = user?.role;

  const location = useLocation();
  const navigate = useNavigate();

  const canCreate = canCreateUnit(role);
  const canEdit = canEditUnit(role);
  const canDelete = canDeleteUnit(role);
  const showFilter = canSeeUnitSubdistrictFilter(role);

  const [units, setUnits] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [subdistricts, setSubdistricts] = useState([]);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [splitTarget, setSplitTarget] = useState(null);

  const [deleteUnit, setDeleteUnit] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get('action') === 'add' && canCreate) {
      setShowAddModal(true);
      navigate('/units', { replace: true });
    }
  }, [location.search, canCreate, navigate]);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const getFilters = useCallback(() => ({
        search: search || undefined,
        subdistrictId: subdistrict || undefined,
  }), [search, subdistrict]);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await unitService.getUnits({
        ...getFilters(),
        page,
        limit: PAGE_SIZE
      });

      const data = res.data?.data ?? res.data;

      setUnits(data.units ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
    } catch (err) {
      setError(
        err.response?.data?.message ?? 'Failed to load units'
      );
    } finally {
      setLoading(false);
    }
  }, [getFilters, page]);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await unitService.getUnits({ ...getFilters(), export: true });
      const data = res.data?.data ?? res.data;
      exportCsv('units.csv', [
        { label: 'Unit', value: row => row.UnitName },
        { label: 'Subdistrict', value: row => row.SubdistrictName },
        { label: 'Members', value: row => row.MemberCount ?? 0 },
        { label: 'Leaders', value: row => row.LeaderNames },
        { label: 'Assistant Leaders', value: row => row.AssistantLeaderNames },
        { label: 'Status', value: row => Number(row.IsActive) ? 'Active' : 'Inactive' },
      ], data.units ?? []);
    } catch (err) {
      setExportError(err.response?.data?.message ?? 'Failed to export units');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  useEffect(() => {
    if (!showFilter) return;

    unitService.getSubdistricts()
      .then((res) => {
        setSubdistricts(
          res.data?.data ?? res.data ?? []
        );
      });
  }, [showFilter]);

  const handleDelete = async () => {
    if (!deleteUnit) return;

    try {
      setDeleting(true);

      await unitService.deleteUnit(deleteUnit.UnitID);

      setDeleteUnit(null);
      fetchUnits();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to delete unit');
    } finally {
      setDeleting(false);
    }
  };

  const pageNums = (() => {
    const start = Math.max(1, Math.min(totalPages - 4, page - 2));
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  })();

  if (!canAccessUnitsPage(role)) {
    return (
      <div className="up">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="up">
      {/* Header */}
      <div className="up__header">
        <div>
          <h1 className="up__title">
            Unit Management
          </h1>
          <p className="up__subtitle">
            Manage church units and assigned leaders.
          </p>
        </div>

        {canCreate && (
          <button
            className="btn btn--primary btn--md"
            onClick={() => setShowAddModal(true)}
          >
            + Create Unit
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="list-export-toolbar">
        <div className="up__controls">
          <input
            className="up__input"
            placeholder="Search units..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />

          {showFilter && (
            <select
              className="up__select"
              value={subdistrict}
              onChange={(e) => {
                setSubdistrict(e.target.value);
                setPage(1);
              }}
            >
              <option value="">
                Subdistrict: All
              </option>

              {subdistricts.map((s) => (
                <option
                  key={s.SubdistrictID}
                  value={s.SubdistrictID}
                >
                  {s.SubdistrictName}
                </option>
              ))}
            </select>
          )}
        </div>
        <button type="button" className="btn btn--ghost btn--md" onClick={handleExport} disabled={exporting} aria-label={exporting ? 'Exporting CSV' : 'Export CSV'} aria-busy={exporting} title="Export CSV">
          <span className="material-symbols-outlined" aria-hidden="true">{exporting ? 'hourglass_empty' : 'file_download'}</span>
          CSV
        </button>
      </div>

      {error && (
        <div className="up__error alert-error" role="alert">
          {error}
        </div>
      )}

      {/* Table */}
      {exportError && <div className="up__error alert-error" role="alert">{exportError}</div>}

      <div className="up__table-card">
        <div className="up__table-header">
          <h2 className="up__section-title">
            All Units ({total})
          </h2>
        </div>

        <div className="up__table-wrap">
          <table className="up__table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Subdistrict</th>
                <th>Members</th>
                <th>Leaders</th>
                <th>Assistant Leaders</th>
                <th>Status</th>
                <th className="up__actions-header">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7">
                    Loading units...
                  </td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan="7" className="up__empty-state">
                    No units found.
                  </td>
                </tr>
              ) : (
                units.map((unit) => (
                  <tr key={unit.UnitID} className="up__row organization-row" tabIndex={0} onClick={() => navigate(`/units/${unit.UnitID}`)} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); navigate(`/units/${unit.UnitID}`); } }}>
                    <td>
                      <div className="up__unit-name">
                        <div className="up__avatar">
                          {unit.UnitName?.charAt(0)}
                        </div>
                        {unit.UnitName}
                      </div>
                    </td>

                    <td>
                      {unit.SubdistrictName ?? '—'}
                    </td>

                    <td className="up__center-cell">
                      {unit.MemberCount ?? 0}
                    </td>
                    <td className="organization-leaders">{unit.LeaderNames || 'Unassigned'}</td>
                    <td className="organization-leaders">{unit.AssistantLeaderNames || 'Unassigned'}</td>

                    <td><span className={`organization-status organization-status--${Number(unit.IsActive) ? 'active' : 'inactive'}`}>{Number(unit.IsActive) ? 'Active' : 'Inactive'}</span></td>
                      <td className="up__actions-cell" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                      <div className="up__action-group">


                        {canCreate && canEdit && (
                          <button className="btn btn--ghost btn--sm" disabled={Boolean(getHierarchySplitReason(unit))} title={getHierarchySplitReason(unit) || undefined} onClick={() => setSplitTarget(unit)}>Split</button>
                        )}
                        {canDelete && (
                          <button
                            className="btn btn--danger-ghost btn--sm"
                            onClick={() => setDeleteUnit(unit)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="up__pagination">
            <span>
              Page {page} of {totalPages}
            </span>

            <div className="up__pagination-buttons">
              <button
                className="up__page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </button>

              {pageNums.map((n) => (
                <button
                  key={n}
                  className={`up__page-btn${n === page ? ' up__page-btn--active' : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}

              <button
                className="up__page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Unit Modal */}
      {splitTarget && (
        <SplitHierarchyModal kind="unit" source={splitTarget}
          onClose={() => setSplitTarget(null)}
          onSplit={() => { setSplitTarget(null); fetchUnits(); }} />
      )}
      {showAddModal && (
        <AddUnitModal
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false);
            fetchUnits();
          }}
        />
      )}


      {/* Delete Unit Modal */}
      {deleteUnit && (
        <DeleteUnitModal
          unit={deleteUnit}
          loading={deleting}
          onClose={() => setDeleteUnit(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};

export default UnitsPage;
