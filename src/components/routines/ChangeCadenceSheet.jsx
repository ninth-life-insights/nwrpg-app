// src/components/routines/ChangeCadenceSheet.jsx
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { changeMissionCadence } from '../../services/missionService';
import { DUE_TYPES } from '../../types/Mission';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import ErrorMessage from '../ui/ErrorMessage';
import './ChangeCadenceSheet.css';

// Five-option cadence picker for routine missions. Picking a non-current
// option mutates the mission's type/recurrence in one write via
// changeMissionCadence, then closes. The current cadence is highlighted
// and non-tappable so the chip selection doesn't accidentally reset
// recurrence state to its default for "the same" choice.
const OPTIONS = [
  { value: 'evergreen', label: 'Evergreen', sub: 'always available' },
  { value: 'daily',     label: 'Daily',     sub: 'every day' },
  { value: 'weekly',    label: 'Weekly',    sub: 'once a week' },
  { value: 'monthly',   label: 'Monthly',   sub: 'once a month' },
  { value: 'yearly',    label: 'Yearly',    sub: 'once a year' },
];

const resolveCurrentCadence = (mission) => {
  if (!mission) return null;
  if (mission.dueType === DUE_TYPES.EVERGREEN) return 'evergreen';
  if (mission.dueType === DUE_TYPES.RECURRING) return mission.recurrence?.pattern || null;
  return null;
};

const ChangeCadenceSheet = ({ mission, onClose, onChanged }) => {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useModalBackButton(true, onClose);

  const currentCadence = useMemo(() => resolveCurrentCadence(mission), [mission]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handlePick = async (cadence) => {
    if (cadence === currentCadence) return;
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await changeMissionCadence(currentUser.uid, mission.id, cadence);
      await onChanged?.();
      onClose();
    } catch (err) {
      console.error('Change cadence failed:', err);
      setSaveError("That cadence change didn't save. Try again.");
      setSaving(false);
    }
  };

  const content = (
    <div className="change-cadence-overlay" onClick={handleBackdropClick}>
      <div className="change-cadence-sheet" role="dialog" aria-modal="true">
        <div className="change-cadence-header">
          <h2 className="change-cadence-title">Change cadence</h2>
          <button
            type="button"
            className="change-cadence-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="change-cadence-body">
          <p className="change-cadence-mission">{mission.title}</p>
          <div className="change-cadence-options" role="radiogroup" aria-label="Cadence">
            {OPTIONS.map((opt) => {
              const isCurrent = opt.value === currentCadence;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isCurrent}
                  disabled={isCurrent || saving}
                  className={`change-cadence-option ${isCurrent ? 'is-current' : ''}`}
                  onClick={() => handlePick(opt.value)}
                >
                  <span className="change-cadence-option-main">
                    <span className="change-cadence-option-label">{opt.label}</span>
                    <span className="change-cadence-option-sub">{opt.sub}</span>
                  </span>
                  {isCurrent && (
                    <span className="change-cadence-option-current">Current</span>
                  )}
                </button>
              );
            })}
          </div>
          {saveError && <ErrorMessage message={saveError} />}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default ChangeCadenceSheet;
