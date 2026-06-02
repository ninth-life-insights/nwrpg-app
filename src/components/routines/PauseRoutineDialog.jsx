// src/components/routines/PauseRoutineDialog.jsx
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';
import { useRoutines } from '../../contexts/RoutineContext';
import { pauseRoutine } from '../../services/routineService';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import ErrorMessage from '../ui/ErrorMessage';
import './PauseRoutineDialog.css';

// Bottom-sheet dialog for pausing (or extending an existing pause on) the
// routine. Uses a native <input type="date"> with min set to tomorrow so
// "until today" can't be selected — a same-day end date would be a no-op
// pause. The service also rejects today/past on its end as a backstop.
const PauseRoutineDialog = ({
  routineId,
  initialDate,
  onClose,
  onPaused,
}) => {
  const { currentUser } = useAuth();
  const { refreshRoutines } = useRoutines();
  const tomorrow = useMemo(
    () => dayjs().add(1, 'day').format('YYYY-MM-DD'),
    []
  );
  const [endDate, setEndDate] = useState(initialDate || tomorrow);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  useModalBackButton(true, onClose);

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleConfirm = async () => {
    if (!endDate || saving) return;
    setSaveError(null);
    setSaving(true);
    try {
      await pauseRoutine(currentUser.uid, routineId, endDate);
      await refreshRoutines();
      onPaused?.();
      onClose();
    } catch (err) {
      console.error('Pause routine failed:', err);
      setSaveError(err?.message || "Pausing didn't go through. Try again.");
      setSaving(false);
    }
  };

  const isEditing = !!initialDate;
  const title = isEditing ? 'Change pause end date' : 'Pause routine';
  const confirmLabel = saving
    ? 'Saving…'
    : isEditing
    ? 'Save'
    : 'Pause routine';

  const content = (
    <div className="pause-routine-overlay" onClick={handleBackdrop}>
      <div className="pause-routine-sheet" role="dialog" aria-modal="true">
        <div className="pause-routine-header">
          <h2 className="pause-routine-title">{title}</h2>
          <button
            type="button"
            className="pause-routine-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="pause-routine-body">
          <p className="pause-routine-explainer">
            Your routine will be hidden until this date. Items resume
            automatically — daily and weekly tasks pick up at their next
            natural occurrence, yearly ones just shift forward.
          </p>

          <label className="pause-routine-field">
            <span className="pause-routine-label">Resume on</span>
            <input
              type="date"
              className="pause-routine-input"
              min={tomorrow}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>

          {saveError && <ErrorMessage message={saveError} />}
        </div>

        <div className="pause-routine-footer">
          <button
            type="button"
            className="pause-routine-cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pause-routine-confirm"
            onClick={handleConfirm}
            disabled={saving || !endDate || endDate <= dayjs().format('YYYY-MM-DD')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default PauseRoutineDialog;
