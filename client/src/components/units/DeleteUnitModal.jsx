import ConfirmDialog from '../layout/ConfirmDialog.jsx';

const DeleteUnitModal = ({
  unit,
  onClose,
  onConfirm
}) => {
  if (!unit) return null;

  return (
    <ConfirmDialog
      title="Delete Unit"
      message={
        <>
          Are you sure you want to delete <strong>"{unit.UnitName}"</strong>?
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

export default DeleteUnitModal;