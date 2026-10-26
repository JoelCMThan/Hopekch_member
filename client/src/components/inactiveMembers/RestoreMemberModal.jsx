import { useState } from 'react';
import ConfirmDialog from '../layout/ConfirmDialog';
import inactiveMemberService from '../../services/inactiveMemberService';

const RestoreMemberModal = ({
  member,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);

  if (!member) return null;

  const handleRestore = async () => {
    try {
      setLoading(true);
      await inactiveMemberService.activateMember(member.MemberID);
      if (onSuccess) onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmDialog
      title="Activate Member"
      message={
        <>
          Are you sure you want to activate{' '}
          <strong>
            {member.FirstName} {member.LastName}
          </strong>
          ?
          <br />
          This member will become active again.
        </>
      }
      confirmLabel={loading ? 'Activating...' : 'Activate'}
      cancelLabel="Cancel"
      danger={true}
      onConfirm={handleRestore}
      onCancel={onClose}
    />
  );
};

export default RestoreMemberModal;