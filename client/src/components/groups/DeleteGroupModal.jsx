import ConfirmDialog from '../layout/ConfirmDialog.jsx';

const DeleteGroupModal = ({
  group,
  onClose,
  onConfirm
}) => {
  if (!group) return null;

  return (
    <ConfirmDialog
      title="Delete Life Group"
      message={
        <>
          Are you sure you want to delete{' '}
          <strong>"{group.LifeGroupName}"</strong>?
          <br />
          This action is <strong>permanent</strong>.
        </>
      }
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
};

export default DeleteGroupModal;