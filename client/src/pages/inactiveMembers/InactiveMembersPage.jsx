import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import inactiveMemberService from '../../services/inactiveMemberService';
import useAuth from '../../hooks/useAuth';
import { canDeactivateMember, canActivateMember } from '../../permissions/inactiveMember';
import { canManageMember } from '../../permissions/members';
import DeactivateMemberModal from '../../components/inactiveMembers/DeactivateMemberModal';
import RestoreMemberModal from '../../components/inactiveMembers/RestoreMemberModal';
import './inactiveMember.css';

/* ── Helpers ───────────────────────────────────────────────── */

const getInitials = (firstName, lastName) => {
  const first = firstName?.charAt(0) || '';
  const last = lastName?.charAt(0) || '';
  return `${first}${last}`.toUpperCase();
};

const getReasonClass = (reason) => {
  if (!reason) return 'inactive-members__reason inactive-members__reason--unknown';

  switch (reason) {
    case 'Transferred University':
      return 'inactive-members__reason inactive-members__reason--violet';
    case 'Moved':
      return 'inactive-members__reason inactive-members__reason--amber';
    case 'Changed Church':
      return 'inactive-members__reason inactive-members__reason--blue';
    case 'Migrant':
      return 'inactive-members__reason inactive-members__reason--rose';
    case 'Personal':
      return 'inactive-members__reason inactive-members__reason--green';
    case 'Others':
    default:
      return 'inactive-members__reason inactive-members__reason--unknown';
  }
};

/* ── Page ──────────────────────────────────────────────────── */

const InactiveMembersPage = () => {
  const { user } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  const [members, setMembers]               = useState([]);
  const [total, setTotal]                   = useState(0);
  const [totalPages, setTotalPages]         = useState(1);
  const [page, setPage]                     = useState(1);
  const [search, setSearch]                 = useState('');
  const [reason, setReason]                 = useState('');
  const [loading, setLoading]               = useState(true);
  const [fetchError, setFetchError]         = useState('');

  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [selectedMember, setSelectedMember]           = useState(null);
  const [activateTarget, setActivateTarget]           = useState(null);

  const [editingDetails, setEditingDetails] = useState(false);

  const PAGE_SIZE = 10;

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (
      params.get('action') === 'deactivate' &&
      canDeactivateMember(user?.role)
    ) {
      setShowDeactivateModal(true);
      navigate('/inactive-members', { replace: true });
    }
  }, [location.search, user?.role, navigate]);

  /* ── Fetch inactive members ─────────────────────────────── */

  const fetchInactiveMembers = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const response = await inactiveMemberService.getInactiveMembers({
        search,
        page,
        limit: PAGE_SIZE,
        reason,
      });

      const payload = response.data?.data ?? response.data ?? {};
      const data = Array.isArray(payload) ? { members: payload } : payload;

      setMembers(Array.isArray(data.members) ? data.members : []);
      setTotal(Number(data.total) || 0);
      setTotalPages(Number(data.totalPages) || 1);
    } catch (error) {
      console.error('Failed to fetch inactive members:', error);
      setFetchError(
        error.response?.data?.message || 'Failed to load inactive members.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInactiveMembers();
  }, [page, search, reason]);

  /* ── Search ─────────────────────────────────────────────── */

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPage(1);
  };

  /* ── Deactivate ─────────────────────────────────────────── */

  const handleOpenDeactivate = () => {
    setShowDeactivateModal(true);
  };

  const handleDeactivateSuccess = () => {
    setShowDeactivateModal(false);
    fetchInactiveMembers();
  };

  /* ── Pagination ─────────────────────────────────────────── */

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="ip">
      <div className="ip__header">
        <div>
          <h1 className="ip__title">Inactive Members</h1>
          <p className="ip__subtitle">
            Manage and track former members and their transition information.
          </p>
        </div>

        {canDeactivateMember(user?.role) && (
          <button
            type="button"
            className="ip__create-btn btn btn--primary btn--md"
            onClick={handleOpenDeactivate}
          >
            <span className="material-symbols-outlined">person_add</span>
            <span>Add Inactive Member</span>
          </button>
        )}
      </div>

      <div className="ip__controls">
        <input
          className="ip__input"
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search inactive members..."
        />

        <select
          className="ip__select"
          value={reason}
          onChange={(e) => { setReason(e.target.value); setPage(1); }}
        >
          <option value="">All reasons</option>
          <option value="Transferred University">Transferred University</option>
          <option value="Moved">Moved</option>
          <option value="Changed Church">Changed Church</option>
          <option value="Migrant">Migrant</option>
          <option value="Personal">Personal</option>
          <option value="Others">Others</option>
        </select>
      </div>

      {fetchError && <div className="ip__error">{fetchError}</div>}

      <div className="ip__table-card">
        <div className="ip__table-header">
          <h2 className="ip__section-title">All Inactive Members ({total})</h2>
        </div>

        <div className="ip__table-wrap">
          <table className="ip__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Subdistrict</th>
                <th>Unit</th>
                <th>Life Group</th>
                <th>Reason</th>
                <th>Notes</th>
                <th className="ip__actions-header">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="ip__empty-state">
                    Loading inactive members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan="7" className="ip__empty-state">
                    No inactive members found.
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr
                    key={member.MemberID}
                    className="ip__row ip__row--clickable"
                    onClick={() => setSelectedMember(member)}

                  >
                    <td>
                      <div className="ip__member-name-cell">
                        <div className="ip__avatar">
                          {getInitials(member.FirstName, member.LastName)}
                        </div>

                        <div className="ip__member-info">
                          <div className="ip__member-name">
                            {member.FirstName} {member.LastName}
                          </div>
                          {member.Email && (
                            <div className="ip__member-email">
                              {member.Email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>{member.SubdistrictName || '—'}</td>
                    <td>{member.UnitName || '—'}</td>
                    <td>{member.LifeGroupName || '—'}</td>

                    <td>
                      <span className={getReasonClass(member.InactiveReason)}>
                        {member.InactiveReason || 'Unknown'}
                      </span>
                    </td>

                    <td>
                      <div className="ip__notes" title={member.InactiveNotes || ''}>
                        {member.InactiveNotes || '—'}
                      </div>
                    </td>

                    <td className="ip__actions-cell">
                      <div className="ip__action-group">
                        {canActivateMember(user?.role) && (
                          <button
                            type="button"
                            title="Activate Member"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActivateTarget(member);
                            }}
                            className="btn btn--sm btn--danger-ghost"
                          >
                            Activate
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
      </div>

      <div className="ip__pagination">
        <div className="ip__pagination-controls">
          <button
            type="button"
            onClick={handlePreviousPage}
            disabled={page <= 1 || loading}
            className="ip__pagination-btn"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>

          <span>
            {page} / {totalPages}
          </span>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={page >= totalPages || loading}
            className="ip__pagination-btn"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      {showDeactivateModal && (
        <DeactivateMemberModal
          onClose={() => setShowDeactivateModal(false)}
          onSuccess={handleDeactivateSuccess}
        />
      )}

      {activateTarget && (
        <RestoreMemberModal
          member={activateTarget}
          onClose={() => setActivateTarget(null)}
          onSuccess={fetchInactiveMembers}
        />
      )}

      {editingDetails && selectedMember && (
        <DeactivateMemberModal
          member={selectedMember}
          editMode
          onClose={() => setEditingDetails(false)}
          onSuccess={({ reason, notes }) => {
            setSelectedMember(current => ({ ...current, InactiveReason: reason, InactiveNotes: notes }));
            fetchInactiveMembers();
          }}
        />
      )}

      {selectedMember && !editingDetails && (
        <div
          className="ip__details-overlay"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="ip__details-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ip__details-header">
              <div>
                <h2>
                  {selectedMember.FirstName} {selectedMember.LastName}
                </h2>
                <p>Inactive Member Details</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="ip__details-close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="ip__details-body">
              <div>
                <span>Subdistrict</span>
                <strong>{selectedMember.SubdistrictName || '—'}</strong>
              </div>

              <div>
                <span>Unit</span>
                <strong>{selectedMember.UnitName || '—'}</strong>
              </div>

              <div>
                <span>Life Group</span>
                <strong>{selectedMember.LifeGroupName || '—'}</strong>
              </div>

              <div>
                <span>Reason</span>
                <strong>{selectedMember.InactiveReason || '—'}</strong>
              </div>

              <div>
                <span>Additional Notes</span>
                <strong>{selectedMember.InactiveNotes || '—'}</strong>
              </div>

              <div>
                <span>Deactivated Date</span>
                <strong>
                  {selectedMember.DeactivatedDate
                    ? new Date(selectedMember.DeactivatedDate).toLocaleDateString('en-GB')
                    : '—'}
                </strong>
              </div>
            </div>

            <div className="ip__details-footer">
              {canDeactivateMember(user?.role) && canManageMember(user?.role, selectedMember.Role) && (
                <button type="button" className="btn btn--ghost btn--md" onClick={() => setEditingDetails(true)}>
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InactiveMembersPage;
