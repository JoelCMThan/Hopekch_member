import ConfirmDialog from '../layout/ConfirmDialog';

const DeleteSubdistrictModal = ({ subdistrict, onClose, onConfirm }) => {
  if (!subdistrict) return null;

  return (
    <ConfirmDialog
      title="Delete Subdistrict"
      message={
        <>
          Are you sure you want to delete{' '}
          <strong>"{subdistrict.SubdistrictName}"</strong>?
          <br />
          This action is <strong>permanent</strong>.
        </>
      }
      confirmLabel="Delete"
      cancelLabel="Cancel"
      danger={true}
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
};

export default DeleteSubdistrictModal;