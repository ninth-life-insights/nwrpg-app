// src/components/base/RoomRoutineSection.jsx
import { useMemo, useState } from 'react';
import { useRoutines } from '../../contexts/RoutineContext';
import { isMissionInRoutineSet } from '../../utils/routineHelpers';
import { DEFAULT_ROUTINE_ID } from '../../types/Routine';
import { RECURRENCE_PATTERNS } from '../../utils/recurrenceHelpers';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import QuickAddRoutineSheet from '../routines/QuickAddRoutineSheet';
import './RoomRoutineSection.css';

// Room-scoped surface of the user's routine — discoverability +
// flexibility from the room context. Shows just the routine tasks
// whose baseLocation matches this room (Entire-Base routines aren't
// shown here; they're cross-room and live in the broader builder).
// Add affordance opens QuickAddRoutineSheet with the room locked and a
// frequency picker at the top, so the user can add a task in any
// cadence without leaving the room.
const RoomRoutineSection = ({
  roomId,
  missions,
  onToggleComplete,
  onMissionChanged,
}) => {
  const { routineRootSet, refreshRoutines } = useRoutines();
  const [showAdd, setShowAdd] = useState(false);

  // After an add, refresh the routine context (so routineRootSet picks up
  // the new chain root) AND the parent's missions list (so the new mission
  // appears in this room's filtered view).
  const handleAdded = async () => {
    await refreshRoutines();
    onMissionChanged?.();
  };

  const roomRoutineMissions = useMemo(() => {
    if (!Array.isArray(missions) || !roomId) return [];
    return missions.filter((m) => {
      if (!m) return false;
      if (m.status !== 'active') return false;
      if (m.baseLocation !== roomId) return false;
      return isMissionInRoutineSet(m, routineRootSet);
    });
  }, [missions, roomId, routineRootSet]);

  const isEmpty = roomRoutineMissions.length === 0;

  return (
    <section className="room-routine-section">
      <div className="room-routine-section-header">
        <h2 className="room-routine-section-title">Routine here</h2>
        <button
          type="button"
          className="room-routine-section-add"
          onClick={() => setShowAdd(true)}
        >
          + Add to routine
        </button>
      </div>

      {isEmpty ? (
        <p className="room-routine-section-empty">
          No routine tasks for this room yet. Add one to make it part of your
          regular rhythm here.
        </p>
      ) : (
        <div className="room-routine-section-list">
          {roomRoutineMissions.map((mission) => (
            <MissionCardCondensed
              key={mission.id}
              mission={mission}
              onToggleComplete={onToggleComplete}
              onMissionChanged={onMissionChanged}
              hideRoutineBadge
            />
          ))}
        </div>
      )}

      {showAdd && (
        <QuickAddRoutineSheet
          frequency={RECURRENCE_PATTERNS.DAILY}
          routineId={DEFAULT_ROUTINE_ID}
          defaultRoomId={roomId}
          showFrequencyPicker
          lockRoom
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
        />
      )}
    </section>
  );
};

export default RoomRoutineSection;
