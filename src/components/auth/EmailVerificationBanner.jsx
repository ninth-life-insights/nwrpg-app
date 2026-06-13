import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './EmailVerificationBanner.css';

export default function EmailVerificationBanner() {
  const { currentUser, resendVerificationEmail } = useAuth();
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'
  // Local mirror of emailVerified — currentUser.emailVerified is set at
  // sign-in. We reload() on mount IF unverified so a user who clicked the
  // link in another tab sees the banner disappear when they come back.
  const [verified, setVerified] = useState(currentUser?.emailVerified ?? true);

  useEffect(() => {
    if (!currentUser || currentUser.emailVerified) return;
    currentUser.reload()
      .then(() => setVerified(currentUser.emailVerified))
      .catch(() => { /* offline / transient — keep showing banner */ });
  }, [currentUser]);

  if (!currentUser || verified) return null;

  const handleResend = async () => {
    setStatus('sending');
    try {
      await resendVerificationEmail();
      setStatus('sent');
    } catch (err) {
      console.error('Resend verification error:', err);
      setStatus('error');
    }
  };

  return (
    <div className="email-verification-banner" role="status">
      <div className="email-verification-banner-text">
        {status === 'sent'
          ? `New link sent to ${currentUser.email}. Tap it, then refresh this page.`
          : status === 'error'
          ? "That email didn't send. Try again in a minute."
          : `Verify your email: check ${currentUser.email} for a link.`}
      </div>
      {status !== 'sent' && (
        <button
          type="button"
          className="email-verification-banner-button"
          onClick={handleResend}
          disabled={status === 'sending'}
        >
          {status === 'sending' ? 'Sending...' : 'Resend'}
        </button>
      )}
    </div>
  );
}
