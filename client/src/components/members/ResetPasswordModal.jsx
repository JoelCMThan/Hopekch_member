/**
 * ResetPasswordModal
 * Used by leaders/admin to set or reset a member's password,
 * and by members themselves to change their own password.
 */
import { useState } from 'react';
import memberService from '../../services/memberService';
import { CloseIcon } from '../icons';
import './Modal.css';

const ResetPasswordModal = ({ member, onClose, onSave, isSelf = false }) => {
  const memberName = member ? `${member.FirstName} ${member.LastName}` : '';
  const hasAccount = Boolean(member?.UserID);

  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState('');

  const validate = () => {
    if (!password)              return 'Password is required.';
    if (password.length < 6)   return 'Password must be at least 6 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ve = validate();
    if (ve) { setError(ve); return; }
    setSaving(true);
    setError('');
    try {
      await memberService.resetPassword(member.MemberID, password);
      onSave?.();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to update password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const title = isSelf
    ? 'Change My Password'
    : hasAccount ? `Reset Password — ${memberName}` : `Set Password — ${memberName}`;

  const desc = isSelf
    ? 'Enter a new password for your account.'
    : hasAccount
      ? `Set a new password for ${memberName}. They will need this to sign in.`
      : `Create a login account for ${memberName}. Share the password with them so they can sign in.`;

  const btnLabel = isSelf ? 'Change Password' : hasAccount ? 'Reset Password' : 'Set Password';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--sm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">

        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>

        <form className="modal__body reset-password__body" onSubmit={handleSubmit} >
          <p className="reset-password__description">{desc}</p>

          {error && <div className="modal__error-banner">{error}</div>}

          <div className="form-field">
            <label className="form-label">New Password *</label>
            <div className="login-password-wrap">
              <input
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Min. 6 characters"
                autoFocus
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Confirm Password *</label>
            <input
              className="form-input"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
              placeholder="Re-enter password"
            />
          </div>

          <label className="form-checkbox-label">
            <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(v => !v)} />
            Show passwords
          </label>

          <div className="modal__footer reset-password__footer" >
            <button type="button" className="btn btn--ghost btn--md" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary btn--md" disabled={saving}>
              {saving ? 'Saving…' : btnLabel}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default ResetPasswordModal;
