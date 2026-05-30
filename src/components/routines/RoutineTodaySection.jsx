// src/components/routines/RoutineTodaySection.jsx
import { useMemo, useState } from 'react';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import ErrorMessage from '../ui/ErrorMessage';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  uncompleteMission,
  completeMissionWithRecurrence,
} from '../../services/missionService';
import { getTodaysRoutineMissions } from '../../utils/routineHelpers';
import './RoutineTodaySection.css';

// "Today" surface for the routine page — the action view. Shows active routine
// missions that are due today or overdue, sorted earliest first (so anything
// hanging from yesterday surfaces above today's items). Completing a card
// spawns the next instance via the existing recurrence flow, then the
// completed mission drops out of this view automatically (the next instance
// has a future dueDate and the completed one is no longer ACTIVE).
const RoutineTodaySection = ({ missions, routineRootSet, onSaved }) => {
  const { currentUser } = useAuth();
  const { notifyMissionCompletion } = useNotifications();
  const [actionError, setActionError] = useState(null);

  const todayMissions = useMemo(
    () => getTodaysRoutineMissions(missions, routineRootSet),
    [missions, routineRootSet]
  );

  const handleToggleComplete = async (missionId, isCurrentlyCompleted) => {
    setActionError(null);
    try {
      if (isCurrentlyCompleted) {
        await uncompleteMission(currentUser.uid, missionId);
      } else {
        const result = await completeMissionWithRecurrence(
          currentUser.uid,
          missionId
        );
        notifyMissionCompletion(result);
      }
      await onSaved?.();
    } catch (err) {
      console.error('Routine today toggle failed:', err);
      setActionError(
        isCurrentlyCompleted
          ? "That undo didn't go through."
          : "That mission didn't complete."
      );
    }
  };

  const isEmpty = todayMissions.length === 0;

  return (
    <section className="routine-today">
      <div className="routine-today-header">
        <h2 className="routine-today-title">Today</h2>
        {!isEmpty && (
          <span className="routine-today-count">{todayMissions.length}</span>
        )}
      </div>

      {actionError && <ErrorMessage message={actionError} />}

      {isEmpty ? (
        <div className="routine-today-empty">
          Your routine is clear today. Take the win.
        </div>
      ) : (
        <div className="routine-today-list">
          {todayMissions.map((mission) => (
            <MissionCardCondensed
              key={mission.id}
              mission={mission}
              hideRecurrenceBadge
              onToggleComplete={handleToggleComplete}
              onMissionChanged={onSaved}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default RoutineTodaySection;
