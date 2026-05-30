// src/components/routines/RoutineTodaySection.jsx
import { useMemo, useState } from 'react';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import AchievementToast from '../achievements/AchievementToast';
import ErrorMessage from '../ui/ErrorMessage';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  uncompleteMission,
  completeMissionWithRecurrence,
} from '../../services/missionService';
import {
  getTodaysRoutineMissions,
  groupRoutineMissionsByFrequency,
} from '../../utils/routineHelpers';
import './RoutineTodaySection.css';

const BUCKETS = [
  { key: 'daily',   label: 'Daily' },
  { key: 'weekly',  label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly',  label: 'Yearly' },
];

// "Today" surface for the routine page — the action view. Shows active routine
// missions due today or overdue, sorted earliest-first via the helper, and
// then grouped by frequency into mini-buckets so a flat wall of cards doesn't
// hit her without context.
//
// Completing a card spawns the next instance via the existing recurrence flow;
// the completed mission then drops out of this view (next instance has a
// future dueDate, the completed one is no longer ACTIVE).
const RoutineTodaySection = ({ missions, routineRootSet, onSaved }) => {
  const { currentUser } = useAuth();
  const { notifyMissionCompletion } = useNotifications();
  const [actionError, setActionError] = useState(null);
  const [newAchievements, setNewAchievements] = useState([]);

  const todayMissions = useMemo(
    () => getTodaysRoutineMissions(missions, routineRootSet),
    [missions, routineRootSet]
  );

  const groupedToday = useMemo(
    () => groupRoutineMissionsByFrequency(todayMissions),
    [todayMissions]
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
        if (result?.newlyAwardedAchievements?.length > 0) {
          setNewAchievements(result.newlyAwardedAchievements);
        }
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
        BUCKETS.map((bucket) => {
          const list = groupedToday[bucket.key];
          if (!list || list.length === 0) return null;
          return (
            <div key={bucket.key} className="routine-today-group">
              <h3 className="routine-today-group-label">{bucket.label}</h3>
              <div className="routine-today-list">
                {list.map((mission) => (
                  <MissionCardCondensed
                    key={mission.id}
                    mission={mission}
                    hideRecurrenceBadge
                    onToggleComplete={handleToggleComplete}
                    onMissionChanged={onSaved}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      <AchievementToast
        achievements={newAchievements}
        onDismiss={() => setNewAchievements([])}
      />
    </section>
  );
};

export default RoutineTodaySection;
