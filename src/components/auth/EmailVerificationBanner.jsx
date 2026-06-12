import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './EmailVerificationBanner.css';

export default function EmailVerificationBanner() {
  const { currentUser, resendVerificationEmail } = useAuth();
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'

  // currentUser.emailVerified reflects the value at sign-in. After the user
  // clicks the link, they need to reload the page to refresh this flag.
  if (!currentUser || currentUser.emailVerified) return null;

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
