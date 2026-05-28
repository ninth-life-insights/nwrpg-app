import React, { useEffect, useRef, useState } from 'react';
import './UndoActionToast.css';

const AUTO_DISMISS_MS = 5000;

// Generic toast for any reversible action on a mission (delete, archive, etc).
// Caller supplies the label (e.g. "Mission deleted", "Mission archived") and
// an async onUndo that performs the reversal.
const UndoActionToast = ({ label, missionTitle, onUndo, onDismiss }) => {
  const [undoing, setUndoing] = useState(false);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });

  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleUndo = async () => {
    if (undoing) return;
    setUndoing(true);
    try {
      await onUndo();
    } catch (err) {
      console.error('Undo failed:', err);
    }
    onDismiss();
  };

  return (
    <div className="undo-action-toast-wrapper" role="status" aria-live="polite">
      <div className="undo-action-toast">
        <div className="undo-action-toast__text">
          <span className="undo-action-toast__label">{label}</span>
          <span className="undo-action-toast__name">{missionTitle}</span>
        </div>
        <button
          type="button"
          className="undo-action-toast__undo"
          onClick={handleUndo}
          disabled={undoing}
        >
          {undoing ? 'Undoing...' : 'Undo'}
        </button>
        <button
          type="button"
          className="undo-action-toast__close"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <span className="material-icons">close</span>
        </button>
      </div>
    </div>
  );
};

export default UndoActionToast;
