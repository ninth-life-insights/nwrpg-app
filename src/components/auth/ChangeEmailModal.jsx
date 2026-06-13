import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAuthErrorMessage } from '../../utils/authErrors';
import './AccountModal.css';

export default function ChangeEmailModal({ onClose }) {
  const { currentUser, changeEmail } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newEmail.trim()) return setError('Enter a new email address.');
    if (newEmail.trim().toLowerCase() === currentUser?.email?.toLowerCase()) {
      return setError("That's already your email.");
    }
    if (!currentPassword) return setError('Enter your current password to confirm.');

    setSaving(true);
    try {
      await changeEmail(currentPassword, newEmail.trim());
      setSuccess(true);
    } catch (err) {
      setError(getAuthErrorMessage(err, 'change-email'));
      console.error('Change email error:', err);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="account-modal-overlay" onClick={handleBackdropClick}>
      <div className="account-modal">
        <div className="account-modal-header">
          <h2 className="account-modal-title">Change Email</h2>
          <button className="account-modal-close" onClick={onClose} aria-label="Close">
            <span className="material-icons">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="account-modal-body">
            {success ? (
              <div className="account-modal-success">
                Check <strong>{newEmail}</strong> for a verification link. Your
                email will switch to the new address once you tap the link.
                Until then, keep using <strong>{currentUser?.email}</strong> to
                log in.
              </div>
            ) : (
              <>
                <p className="account-modal-help">
                  We'll send a verification link to your new email. Your email
                  only switches after you click it.
                </p>

                <div className="account-modal-field">
                  <label className="account-modal-label" htmlFor="new-email">
                    New email
                  </label>
                  <input
                    id="new-email"
                    className="account-modal-input"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

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
                  {saving ? 'Sending...' : 'Send verification'}
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
