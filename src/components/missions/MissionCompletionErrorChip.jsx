// src/components/missions/MissionCompletionErrorChip.jsx
import { useMissionCompletion } from '../../contexts/MissionCompletionContext';
import './MissionCompletionErrorChip.css';

// Inline error chip rendered by mission cards when the user's last
// completion/uncomplete attempt on this mission failed. Reads the failure
// state from MissionCompletionContext (auto-clears after ERROR_CHIP_MS).
// Returns nothing in the success path — no layout shift unless an error
// is active. Tapping the chip is a no-op; the adjacent toggle button is
// the retry affordance.
const MissionCompletionErrorChip = ({ missionId, className = '' }) => {
  const { hasError } = useMissionCompletion();
  if (!hasError(missionId)) return null;
  return (
    <span
      className={`mission-completion-error-chip ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="material-icons" aria-hidden="true">error_outline</span>
      <span>Tap to retry</span>
    </span>
  );
};

export default MissionCompletionErrorChip;
