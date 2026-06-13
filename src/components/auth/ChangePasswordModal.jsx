import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAuthErrorMessage } from '../../utils/authErrors';
import './AccountModal.css';

export default function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) return setError('Enter your current password.');
    if (newPassword.length < 6) return setError('New password must be at least 6 characters.');
    if (newPassword !== confirmPassword) return setError("New passwords don't match.");
    if (newPassword === currentPassword) {
      return setError('Your new password is the same as your current one.');
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(getAuthErrorMessage(err, 'change-password'));
      console.error('Change password error:', err);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="account-modal-overlay" onClick={handleBackdropClick}>
      <div className="account-modal">
        <div className="account-modal-header">
          <h2 className="account-modal-title">Change Password</h2>
          <button className="account-modal-close" onClick={onClose} aria-label="Close">
            <span className="material-icons">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="account-modal-body">
            {success ? (
              <div className="account-modal-success">
                Your password has been updated. You'll stay signed in on this
                device — you'll need the new password next time you log in
                somewhere else.
              </div>
            ) : (
              <>
                <div className="account-modal-field">
                  <label className="account-modal-label" htmlFor="current-password">
                    Current password
                  </label>
                  <input
                    id="current-password"
                    className="account-modal-input"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="account-modal-field">
                  <label className="account-modal-label" htmlFor="new-password">
                    New password
                  </label>
                  <input
                    id="new-password"
                    className="account-modal-input"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                  />
                </div>

                <div className="account-modal-field">
                  <label className="account-modal-label" htmlFor="confirm-password">
                    Confirm new password
                  </label>
                  <input
                    id="confirm-password"
                    className="account-modal-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                {error && <div className="account-modal-error">{error}</div>}
              </>
            )}
          </div>

          <div className="account-modal-footer">
            {success ? (
              <button
                type="button"
                className="account-modal-save"
                onClick={onClose}
                style={{ flex: 1 }}
              >
                Done
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="account-modal-cancel"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="account-modal-save"
                  disabled={saving}
                >
                  {saving ? 'Updating...' : 'Update password'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
