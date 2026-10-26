import { getHierarchySplitReason } from '../../utils/groupSplit';
import '../members/MemberDetail.css';
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import {
  canAccessSubdistrictsPage,
  canCreateSubdistrict,
  canEditSubdistrict,
  canDeleteSubdistrict,
} from '../../permissions/subdistricts';
import subdistrictService from '../../services/subdistrictService';
import AddSubdistrictModal from '../../components/subdistricts/AddSubdistrictModal';
import DeleteSubdistrictModal from '../../components/subdistricts/DeleteSubdistrictModal';
import SplitHierarchyModal from '../../components/organization/SplitHierarchyModal';
import './Subdistricts.css';

const PAGE_SIZE = 6;

const SubdistrictsPage = () => {
  const { user } = useAuth();
  const role = user?.role;

  const location = useLocation();
  const navigate = useNavigate();

  const canCreate = canCreateSubdistrict(role);
  const canEdit   = canEditSubdistrict(role);
  const canDelete = canDeleteSubdistrict(role);

  const [subdistricts, setSubdistricts] = useState([]);
  const [total, setTotal]               = useState(0);
  const [totalPages, setTotalPages]     = useState(0);
  const [page, setPage]                 = useState(1);
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [splitTarget, setSplitTarget] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get('action') === 'add' && canCreate) {
      setShowAddModal(true);
      navigate('/subdistricts', { replace: true });
    }
  }, [location.search, canCreate, navigate]);

  const fetchSubdistricts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await subdistrictService.getSubdistricts({
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      });
      const data = res.data?.data ?? res.data;
      setSubdistricts(data.subdistricts ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? Math.ceil((data.total ?? 0) / PAGE_SIZE));
    } catch (err) {
      setFetchError(err.response?.data?.message ?? 'Failed to load subdistricts');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    if (canAccessSubdistrictsPage(role)) {
      fetchSubdistricts();
    }
  }, [fetchSubdistricts, role]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const onSaved = () => {
    setShowAddModal(false);
    fetchSubdistricts();
  };

  const onDeleted = async () => {
    try {
      await subdistrictService.deleteSubdistrict(deleteTarget.SubdistrictID);
      setDeleteTarget(null);
      fetchSubdistricts();
    } catch (err) { setFetchError(err.response?.data?.message || 'Failed to delete subdistrict'); setDeleteTarget(null); }
  };

  const pageNums = (() => {
    const start = Math.max(1, Math.min(totalPages - 4, page - 2));
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  })();

  if (!canAccessSubdistrictsPage(role)) {
    return <div className="sp sp__empty">You do not have permission to view this page.</div>;
  }

  return (
    <div className="sp">
      <div className="sp__header">
        <div>
          <h1 className="sp__title">Subdistrict Management</h1>
          <p className="sp__subtitle">
            Manage church subdistrict structures and assignments.
          </p>
        </div>

        {canCreate && (
          <button className="btn btn--primary btn--md" onClick={() => setShowAddModal(true)}>
            + Create Subdistrict
          </button>
        )}
      </div>

      <section className="sp__controls">
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Search subdistricts..."
          className="sp__search-input"
        />
      </section>

      {fetchError && <div className="sp__error">{fetchError}</div>}

      <div className="sp__table-card">
        <div className="sp__table-header">
          <div>
            <h2 className="sp__section-title">All Subdistricts ({total})</h2>
            <p className="sp__section-note">Showing up to {PAGE_SIZE} subdistricts per page.</p>
          </div>
        </div>

        <div className="sp__table-wrap">
          <table className="sp__table">
            <thead>
              <tr>
                <th>Subdistrict</th>
                <th>Units</th>
                <th>Groups</th>
                <th>Members</th>
                <th>Leaders</th>
                <th>Status</th>
                <th className="sp__actions-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="sp__empty-state">Loading subdistricts...</td>
                </tr>
              ) : subdistricts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="sp__empty-state">No subdistricts found.</td>
                </tr>
              ) : (
                subdistricts.map((subdistrict) => (
                  <tr key={subdistrict.SubdistrictID} className="sp__row organization-row" tabIndex={0} onClick={() => navigate(`/subdistricts/${subdistrict.SubdistrictID}`)} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); navigate(`/subdistricts/${subdistrict.SubdistrictID}`); } }}>
                    <td>
                      <div className="sp__name">
                        <div className="sp__avatar">
                          {subdistrict.SubdistrictName?.charAt(0).toUpperCase()}
                        </div>
                        <span>{subdistrict.SubdistrictName}</span>
                      </div>
                    </td>
                    <td className="sp__center-cell">{subdistrict.UnitCount ?? 0}</td>
                    <td className="sp__center-cell">{subdistrict.LifeGroupCount ?? 0}</td>
                    <td className="sp__center-cell">{subdistrict.MemberCount ?? 0}</td>
                    <td className="organization-leaders">{subdistrict.LeaderNames || 'Unassigned'}</td>
                    <td><span className={`organization-status organization-status--${Number(subdistrict.IsActive) ? 'active' : 'inactive'}`}>{Number(subdistrict.IsActive) ? 'Active' : 'Inactive'}</span></td>
                      <td className="sp__actions-cell" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                      <div className="sp__action-group">

                        {canCreate && canEdit && (
                          <button className="btn btn--ghost btn--sm" disabled={Boolean(getHierarchySplitReason(subdistrict))} title={getHierarchySplitReason(subdistrict) || undefined} onClick={() => setSplitTarget(subdistrict)}>Split</button>
                        )}
                        {canDelete && (
                          <button
                            className="btn btn--danger-ghost btn--sm"
                            onClick={() => setDeleteTarget(subdistrict)}
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

        {totalPages > 1 && (
          <div className="sp__pagination">
            <span>Page {page} of {totalPages}</span>
            <div className="sp__pagination-buttons">
              <button
                className="sp__page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </button>
              {pageNums.map((n) => (
                <button
                  key={n}
                  className={`sp__page-btn${n === page ? ' sp__page-btn--active' : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                className="sp__page-btn"
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
        <AddSubdistrictModal
          onClose={() => setShowAddModal(false)}
          onSave={onSaved}
        />
      )}

      {splitTarget && (
        <SplitHierarchyModal kind="subdistrict" source={splitTarget}
          onClose={() => setSplitTarget(null)}
          onSplit={() => { setSplitTarget(null); fetchSubdistricts(); }} />
      )}


      {deleteTarget && (
        <DeleteSubdistrictModal
          subdistrict={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={onDeleted}
        />
      )}
    </div>
  );
};

export default SubdistrictsPage;
