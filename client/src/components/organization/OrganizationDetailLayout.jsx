import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import {
  getGroupSplitReason,
  getHierarchySplitReason,
} from '../../utils/groupSplit';
import ConfirmDialog from '../layout/ConfirmDialog';
import groupService from '../../services/groupService';
import unitService from '../../services/unitService';
import subdistrictService from '../../services/subdistrictService';
import {
  canEditGroup,
  canDeleteGroup,
  canSplitGroup,
} from '../../permissions/groups';
import {
  canEditUnit,
  canDeleteUnit,
  canCreateUnit,
} from '../../permissions/units';
import {
  canEditSubdistrict,
  canDeleteSubdistrict,
  canCreateSubdistrict,
} from '../../permissions/subdistricts';
import EditGroupModal from '../groups/EditGroupModal';
import EditUnitModal from '../units/EditUnitModal';
import EditSubdistrictModal from '../subdistricts/EditSubdistrictModal';
import SplitGroupModal from '../groups/SplitGroupModal';
import SplitHierarchyModal from './SplitHierarchyModal';
import { BackIcon } from '../icons';
import '../../pages/members/MemberDetail.css';

const configs = {
  group: {
    label: 'Life Group',
    plural: 'groups',
    name: 'LifeGroupName',
    service: groupService,
    get: groupService.getGroup,
    remove: groupService.deleteGroup,
    edit: canEditGroup,
    del: canDeleteGroup,
    split: canSplitGroup,
    Editor: EditGroupModal,
  },
  unit: {
    label: 'Unit',
    plural: 'units',
    name: 'UnitName',
    service: unitService,
    get: unitService.getUnit,
    remove: unitService.deleteUnit,
    edit: canEditUnit,
    del: canDeleteUnit,
    split: role => canCreateUnit(role) && canEditUnit(role),
    Editor: EditUnitModal,
  },
  subdistrict: {
    label: 'Subdistrict',
    plural: 'subdistricts',
    name: 'SubdistrictName',
    service: subdistrictService,
    get: subdistrictService.getSubdistrictById,
    remove: subdistrictService.deleteSubdistrict,
    edit: canEditSubdistrict,
    del: canDeleteSubdistrict,
    split: role => canCreateSubdistrict(role) && canEditSubdistrict(role),
    Editor: EditSubdistrictModal,
  },
};

const Row = ({ label, value }) => (
  <div className="detail-row">
    <dt className="detail-row__label">{label}</dt>
    <dd className="detail-row__value">{value ?? '—'}</dd>
  </div>
);

const OrganizationDetailLayout = ({ kind }) => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const config = configs[kind];
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [loadedKey, setLoadedKey] = useState(null);
  const requestKey = `${kind}:${id}:${revision}`;
  const loading = loadedKey !== requestKey;
  const [modal, setModal] = useState(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const reload = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    config.get(id)
      .then(response => {
        if (!cancelled) {
          setRecord(response.data.data);
          setError('');
        }
      })
      .catch(err => {
        if (!cancelled) {
          setRecord(null);
          setError(err.response?.data?.message || 'Could not load details');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey);
      })

    return () => {
      cancelled = true;
    };
  }, [config, id, requestKey]);

  const saved = () => {
    setModal(null);
    reload();
  };

  const confirm = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    try {
      if (modal === 'delete') {
        await config.remove(id);
        navigate(`/${config.plural}`, { replace: true });
      } else {
        await config.service[
          Number(record.IsActive) ? 'inactivate' : 'activate'
        ](id);
        setModal(null);
        await reload();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save changes');
      setModal(null);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  const active = Boolean(Number(record?.IsActive));
  const usable = Boolean(Number(record?.IsUsable));
  const statusAction = active ? 'Inactivate' : 'Activate';
  const Editor = config.Editor;

  return (
    <div className="member-detail">
      <div className="member-detail__breadcrumb">
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => navigate(`/${config.plural}`)}
        >
          <BackIcon />
          {config.plural.charAt(0).toUpperCase() + config.plural.slice(1)}
        </button>
      </div>

      {error && (
        <p role="alert" className="organization-error">
          {error}
        </p>
      )}

      {loading ? (
        <p role="status">Loading details...</p>
      ) : record && (
        <>
          <div className="member-detail__header-card">
            <div className="member-detail__avatar">
              {record[config.name]?.slice(0, 2).toUpperCase()}
            </div>

            <div className="member-detail__header-info">
              <h1 className="member-detail__name">{record[config.name]}</h1>
              <span
                className={`organization-status organization-status--${active ? 'active' : 'inactive'}`}
              >
                {active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="member-detail__header-actions">
              {config.edit(user?.role) && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setModal('edit')}
                >
                  Edit
                </button>
              )}

              {config.split(user?.role) && (
                <button
                  className="btn btn--ghost btn--sm"
                  disabled={!usable}
                  title={(
                    kind === 'group'
                      ? getGroupSplitReason(record)
                      : getHierarchySplitReason(record)
                  ) || undefined}
                  onClick={() => setModal('split')}
                >
                  Split
                </button>
              )}

              {config.edit(user?.role) && (
                <button
                  className={`btn ${active ? 'btn--danger-ghost' : 'btn--ghost'} btn--sm`}
                  onClick={() => setModal('status')}
                >
                  {statusAction}
                </button>
              )}

              {config.del(user?.role) && (
                <button
                  className="btn btn--danger-ghost btn--sm"
                  onClick={() => setModal('delete')}
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {!usable && (
            <p className="organization-notice">
              {kind === 'group'
                ? getGroupSplitReason(record)
                : `Unavailable for new assignments: ${
                  !active
                    ? `this ${config.label.toLowerCase()} is inactive.`
                    : 'a parent is inactive or missing. This record keeps its own Active status.'
                }`}
            </p>
          )}

          <div className="member-detail__grid organization-detail-grid">
            <section className="detail-card">
              <h2 className="detail-card__title">{config.label} Details</h2>
              <dl className="detail-card__body">
                <Row label="Name" value={record[config.name]} />
                <Row label="Leaders" value={record.LeaderNames || 'Unassigned'} />
                {kind !== 'subdistrict' && (
                  <Row
                    label="Assistant Leaders"
                    value={record.AssistantLeaderNames || 'Unassigned'}
                  />
                )}
                {kind !== 'subdistrict' && (
                  <Row label="Subdistrict" value={record.SubdistrictName} />
                )}
                {kind === 'group' && <Row label="Unit" value={record.UnitName} />}
                <Row label="Members" value={record.MemberCount ?? 0} />
                {kind !== 'group' && (
                  <Row label="Life Groups" value={record.LifeGroupCount ?? 0} />
                )}
                {kind === 'subdistrict' && (
                  <Row label="Units" value={record.UnitCount ?? 0} />
                )}
                <Row label="Status" value={active ? 'Active' : 'Inactive'} />
                {kind === 'subdistrict' && (
                  <Row
                    label="Available for assignments"
                    value={usable ? 'Yes' : 'No'}
                  />
                )}
                {kind === 'group' && (
                  <Row label="Meeting Address" value={record.MeetingAddress} />
                )}
              </dl>
            </section>

            <section className="detail-card">
              <h2 className="detail-card__title">
                {kind === 'group'
                  ? 'Members'
                  : kind === 'unit'
                    ? 'Life Groups'
                    : 'Units'}
              </h2>
              <div className="detail-card__body organization-children">
                {kind === 'group'
                  ? record.members?.length
                    ? record.members.map(member => (
                      <Link
                        key={member.MemberID}
                        to={`/members/${member.MemberID}`}
                      >
                        {member.FirstName} {member.LastName}
                      </Link>
                    ))
                    : <p>No members assigned.</p>
                  : record.children?.length
                    ? record.children.map(child => (
                      <div key={child.id}>
                        <Link
                          to={`/${kind === 'unit' ? 'groups' : 'units'}/${child.id}`}
                        >
                          {child.name}
                        </Link>
                        <span
                          className={`organization-status organization-status--${Number(child.IsActive) ? 'active' : 'inactive'}`}
                        >
                          {Number(child.IsActive) ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))
                    : <p>No child records.</p>}
              </div>
            </section>
          </div>
        </>
      )}

      {record && modal === 'edit' && (
        <Editor
          {...{ [kind]: record }}
          onClose={() => setModal(null)}
          onSave={saved}
        />
      )}

      {record && modal === 'split' && (
        kind === 'group' ? (
          <SplitGroupModal
            group={record}
            onClose={() => setModal(null)}
            onSplit={saved}
          />
        ) : (
          <SplitHierarchyModal
            kind={kind}
            source={record}
            onClose={() => setModal(null)}
            onSplit={saved}
          />
        )
      )}

      {record && ['delete', 'status'].includes(modal) && (
        <ConfirmDialog
          title={`${modal === 'delete' ? 'Delete' : statusAction} ${config.label}`}
          message={`Are you sure you want to ${
            modal === 'delete' ? 'delete' : statusAction.toLowerCase()
          } this ${config.label}?${
            modal === 'delete' ? ' This action is permanent.' : ''
          }`}
          confirmLabel={modal === 'delete' ? 'Delete' : statusAction}
          danger={modal === 'delete' || active}
          pending={pending}
          onCancel={() => setModal(null)}
          onConfirm={confirm}
        />
      )}
    </div>
  );
};

export default OrganizationDetailLayout;
