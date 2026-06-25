// src/components/feedback/FeedbackModal.jsx
// Bottom-sheet feedback form. Captures message + optional category; userId,
// displayName, page, and timestamp are recorded automatically. Renders via
// createPortal so no ancestor stacking context can trap it.

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createFeedback } from '../../services/feedbackService';
import { getPageDisplayName } from '../../utils/pageNameHelpers';
import ErrorMessage from '../ui/ErrorMessage';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import './FeedbackModal.css';

const CATEGORIES = [
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idea' },
  { value: 'other', label: 'Other' },
];

const FeedbackModal = ({ page, displayName, onClose }) => {
  const { currentUser } = useAuth();
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [sent, setSent] = useState(false);

  useModalBackButton(true, onClose);

  // Ignore backdrop clicks for the first ~250ms after mount. The synthesized
  // click from the button-tap that opened the modal can land on the freshly
  // mounted overlay and close it immediately ("flash and gone").
  const readyForBackdropClick = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => { readyForBackdropClick.current = true; }, 250);
    return () => clearTimeout(t);
  }, []);

  const handleBackdropClick = (e) => {
    if (!readyForBackdropClick.current) return;
    if (e.target === e.currentTarget && !submitting) onClose();
  };

  const handleChipClick = (value) => {
    setCategory((prev) => (prev === value ? null : value));
  };

  const trimmed = message.trim();
  const canSubmit = !!trimmed && !submitting && !sent;

  const handleSubmit = async () => {
    if (!canSubmit || !currentUser) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createFeedback(currentUser.uid, {
        displayName: displayName || currentUser.email || null,
        page,
        message: trimmed,
        category,
      });
      setSent(true);
      // Hold the thank-you state long enough to feel intentional.
      setTimeout(onClose, 2200);
    } catch (err) {
      console.error('Error sending feedback:', err);
      setSubmitError("Your feedback didn't send.");
      setSubmitting(false);
    }
  };

  const pageLabel = getPageDisplayName(page);
  const userLabel = displayName || currentUser?.email || 'you';

  const content = (
    <div className="feedback-overlay" onClick={handleBackdropClick}>
      <div className="feedback-modal" role="dialog" aria-label="Send feedback">

        {sent ? (
          <div className="feedback-sent-view" role="status" aria-live="polite">
            <h2 className="feedback-sent-title">Thank you!</h2>
            <p className="feedback-sent-subtitle">
              I look forward to reviewing your feedback.
            </p>
          </div>
        ) : (
          <>
            <div className="feedback-header">
              <div className="feedback-header-text">
                <h2 className="feedback-title">Send feedback</h2>
                <p className="feedback-subtitle">Your input helps me improve the beta.</p>
              </div>
              <button
                className="feedback-close"
                onClick={onClose}
                aria-label="Close"
                disabled={submitting}
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="feedback-body">
              <p className="feedback-context">
                On <strong>{pageLabel}</strong> · as <strong>{userLabel}</strong>
              </p>

              <div className="feedback-chip-row" role="group" aria-label="Category">
                {CATEGORIES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`feedback-chip${category === value ? ' is-selected' : ''}`}
                    onClick={() => handleChipClick(value)}
                    aria-pressed={category === value}
                    disabled={submitting}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <textarea
                className="feedback-textarea"
                placeholder="What's on your mind?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={6}
                disabled={submitting}
              />
            </div>

            <div className="feedback-footer">
              {submitError && (
                <ErrorMessage
                  message={submitError}
                  onRetry={handleSubmit}
                  className="feedback-error"
                />
              )}
              <div className="feedback-actions">
                <button
                  type="button"
                  className="feedback-cancel"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="feedback-send"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                >
                  {submitting ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default FeedbackModal;
