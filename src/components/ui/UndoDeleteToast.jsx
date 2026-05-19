import React, { useEffect, useRef, useState } from 'react';
import './UndoDeleteToast.css';

const AUTO_DISMISS_MS = 5000;

const UndoDeleteToast = ({ missionTitle, onUndo, onDismiss }) => {
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
      console.error('Undo restore failed:', err);
    }
    onDismiss();
  };

  return (
    <div className="undo-delete-toast-wrapper" role="status" aria-live="polite">
      <div className="undo-delete-toast">
        <div className="undo-delete-toast__text">
          <span className="undo-delete-toast__label">Mission deleted</span>
          <span className="undo-delete-toast__name">{missionTitle}</span>
        </div>
        <button
          type="button"
          className="undo-delete-toast__undo"
          onClick={handleUndo}
          disabled={undoing}
        >
          {undoing ? 'Restoring...' : 'Undo'}
        </button>
        <button
          type="button"
          className="undo-delete-toast__close"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <span className="material-icons">close</span>
        </button>
      </div>
    </div>
  );
};

export default UndoDeleteToast;
