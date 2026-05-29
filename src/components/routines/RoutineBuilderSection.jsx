// src/components/routines/RoutineBuilderSection.jsx
import { useMemo, useState } from 'react';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import BatchCreateRoutineTasksModal from './BatchCreateRoutineTasksModal';
import AddExistingRecurringModal from './AddExistingRecurringModal';
import ErrorMessage from '../ui/ErrorMessage';
import { useAuth } from '../../contexts/AuthContext';
import { useRoutines } from '../../contexts/RoutineContext';
import { removeMissionFromRoutine } from '../../services/routineService';
import {
  isMissionInRoutineSet,
  groupRoutineMissionsByFrequency,
  getMissionChainRoot,
} from '../../utils/routineHelpers';
import './RoutineBuilderSection.css';

// Bird's-eye view of all routine missions, grouped by recurrence pattern.
// Cards are read-only display + a remove-from-routine action. Tap-to-edit
// (opening MissionCardFull) is deferred to a later phase so the builder stays
// focused on routine membership rather than mission details.
const RoutineBuilderSection = ({
  missions,
  routineRootSet,
  routineId,
  onSaved,
}) => {
  const { currentUser } = useAuth();
  const { refreshRoutines } = useRoutines();
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [removingRootIds, setRemovingRootIds] = useState(new Set());

  const grouped = useMemo(() => {
    const routineMissions = (missions || []).filter((m) =>
      isMissionInRoutineSet(m, routineRootSet)
    );
    return groupRoutineMissionsByFrequency(routineMissions);
  }, [missions, routineRootSet]);

  const total =
    grouped.daily.length +
    grouped.weekly.length +
    grouped.monthly.length +
    grouped.yearly.length;

  const handleRemove = async (mission) => {
    const root = getMissionChainRoot(mission);
    if (!root) return;
    setActionError(null);
    setRemovingRootIds((prev) => new Set(prev).add(root));
    try {
      await removeMissionFromRoutine(currentUser.uid, routineId, root);
      await refreshRoutines();
      onSaved?.();
    } catch (err) {
      console.error('Remove from routine failed:', err);
      setActionError("That mission didn't leave the routine. Try again.");
    } finally {
      setRemovingRootIds((prev) => {
        const next = new Set(prev);
        next.delete(root);
        return next;
      });
    }
  };

  return (
    <section className="routine-builder">
      <div className="routine-builder-head">
        <h2 className="routine-builder-title">Builder</h2>
        <div className="routine-builder-ctas">
          <button
            className="routine-builder-cta routine-builder-cta-primary"
            onClick={() => setShowBatchModal(true)}
          >
            <span className="material-icons">add</span>
            Add new tasks
          </button>
          <button
            className="routine-builder-cta"
            onClick={() => setShowAddExisting(true)}
          >
            <span className="material-icons">playlist_add</span>
            Add existing recurring
          </button>
        </div>
      </div>

      {actionError && <ErrorMessage message={actionError} />}

      {total === 0 ? (
        <div className="routine-builder-empty">
          Your routine is empty.
          <div className="routine-builder-empty-sub">
            Use "Add new tasks" to start building it.
          </div>
        </div>
      ) : (
        <>
          <FrequencyGroup
            label="Daily"
            missions={grouped.daily}
            onRemove={handleRemove}
            removingRootIds={removingRootIds}
          />
          <FrequencyGroup
            label="Weekly"
            missions={grouped.weekly}
            onRemove={handleRemove}
            removingRootIds={removingRootIds}
          />
          <FrequencyGroup
            label="Monthly"
            missions={grouped.monthly}
            onRemove={handleRemove}
            removingRootIds={removingRootIds}
          />
          <FrequencyGroup
            label="Yearly"
            missions={grouped.yearly}
            onRemove={handleRemove}
            removingRootIds={removingRootIds}
          />
        </>
      )}

      {showBatchModal && (
        <BatchCreateRoutineTasksModal
          routineId={routineId}
          onClose={() => setShowBatchModal(false)}
          onSaved={onSaved}
        />
      )}
      {showAddExisting && (
        <AddExistingRecurringModal
          routineId={routineId}
          missions={missions}
          routineRootSet={routineRootSet}
          onClose={() => setShowAddExisting(false)}
          onSaved={onSaved}
        />
      )}
    </section>
  );
};

const FrequencyGroup = ({ label, missions, onRemove, removingRootIds }) => {
  if (!missions || missions.length === 0) return null;
  return (
    <div className="routine-builder-group">
      <h3 className="routine-builder-group-label">
        {label}
        <span className="routine-builder-group-count">{missions.length}</span>
      </h3>
      <div className="routine-builder-group-list">
        {missions.map((mission) => {
          const root = getMissionChainRoot(mission);
          const isRemoving = removingRootIds.has(root);
          return (
            <MissionCardCondensed
              key={mission.id}
              mission={mission}
              readOnly={true}
              actionSlot={
                <button
                  type="button"
                  className="routine-builder-remove"
                  onClick={() => onRemove(mission)}
                  disabled={isRemoving}
                  title="Remove from routine"
                  aria-label="Remove from routine"
                >
                  <span className="material-icons">remove_circle_outline</span>
                </button>
              }
            />
          );
        })}
      </div>
    </div>
  );
};

export default RoutineBuilderSection;
