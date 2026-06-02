// src/components/routines/RoutineTodaySection.jsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import AchievementToast from '../achievements/AchievementToast';
import DatePickerPill from '../ui/DatePickerPill';
import ErrorMessage from '../ui/ErrorMessage';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useRoutines } from '../../contexts/RoutineContext';
import {
  uncompleteMission,
  completeMissionWithRecurrence,
  updateMission,
} from '../../services/missionService';
import {
  resumeRoutine,
  isRoutinePaused,
} from '../../services/routineService';
import {
  getRoutineMissionsForDate,
  groupRoutineMissionsByFrequency,
} from '../../utils/routineHelpers';
import { fromDateString } from '../../utils/dateHelpers';
import { MISSION_STATUS } from '../../types/Mission';
import './RoutineTodaySection.css';

const BUCKETS = [
  { key: 'daily',   label: 'Daily',   icon: 'today' },
  { key: 'weekly',  label: 'Weekly',  icon: 'view_week' },
  { key: 'monthly', label: 'Monthly', icon: 'calendar_month' },
  { key: 'yearly',  label: 'Yearly',  icon: 'view_timeline' },
];

// "Today" surface for the routine page — the action view. The date-picker
// pill mirrors EditDailyMissionsPage's pattern so users have one consistent
// "switch the day I'm looking at" affordance across the app. Today's view
// also surfaces completed-today items so progress through the day stays
// visible.
const RoutineTodaySection = ({
  missions,
  routineRootSet,
  routineOrderMap,
  routineId,
  onOpenPauseDialog,
  onSaved,
}) => {
  const { currentUser } = useAuth();
  const { notifyMissionCompletion } = useNotifications();
  const { routines, pausedRootSet, refreshRoutines } = useRoutines();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState(null);
  const [newAchievements, setNewAchievements] = useState([]);
  const [viewDate, setViewDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [resuming, setResuming] = useState(false);
  const todayString = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const isViewToday = viewDate === todayString;

  // Find the routine being displayed (default for v1) and its pause state.
  const routine = useMemo(
    () => routines.find((r) => r.id === routineId) || null,
    [routines, routineId]
  );
  const paused = !!routine && isRoutinePaused(routine);

  const viewMissions = useMemo(
    () => getRoutineMissionsForDate(missions, routineRootSet, viewDate, routineOrderMap, pausedRootSet),
    [missions, routineRootSet, viewDate, routineOrderMap, pausedRootSet]
  );

  const groupedView = useMemo(
    () => groupRoutineMissionsByFrequency(viewMissions),
    [viewMissions]
  );

  const { activeCount, completedCount } = useMemo(() => {
    let active = 0;
    let completed = 0;
    for (const m of viewMissions) {
      if (m.status === MISSION_STATUS.ACTIVE) active++;
      else if (m.status === MISSION_STATUS.COMPLETED) completed++;
    }
    return { activeCount: active, completedCount: completed };
  }, [viewMissions]);

  const totalCount = activeCount + completedCount;
  const allDone = isViewToday && totalCount > 0 && activeCount === 0;

  // Subtitle adapts to context (today vs future, progress framing vs schedule).
  const subtitleText = useMemo(() => {
    if (isViewToday) {
      if (totalCount === 0) return null;
      if (allDone) return `All ${totalCount} done — take the win 🎉`;
      if (completedCount === 0)
        return activeCount === 1 ? '1 to do' : `${activeCount} to do`;
      return `${completedCount} of ${totalCount} done`;
    }
    if (totalCount === 0) return 'Nothing scheduled';
    return totalCount === 1 ? '1 scheduled' : `${totalCount} scheduled`;
  }, [isViewToday, totalCount, activeCount, completedCount, allDone]);

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

  // Push every still-active item in a bucket to tomorrow. Doesn't touch the
  // recurrence pattern — just shifts the dueDate of the current instance. Next
  // occurrence math runs from there as usual (and patterns that snap to
  // specific weekdays / day-of-month self-correct on subsequent cycles).
  const handleSkipBucket = async (bucketKey) => {
    const list = groupedView[bucketKey] || [];
    const toPush = list.filter((m) => m.status === MISSION_STATUS.ACTIVE);
    if (toPush.length === 0) return;
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
    setActionError(null);
    try {
      await Promise.all(
        toPush.map((m) =>
          updateMission(currentUser.uid, m.id, { dueDate: tomorrow })
        )
      );
      await onSaved?.();
    } catch (err) {
      console.error('Routine skip bucket failed:', err);
      setActionError("Those didn't move. Try again.");
    }
  };

  const hasNoRoutineYet = routineRootSet.size === 0;

  const handleResumeNow = async () => {
    if (resuming) return;
    setResuming(true);
    setActionError(null);
    try {
      await resumeRoutine(currentUser.uid, routineId);
      await refreshRoutines();
      await onSaved?.();
    } catch (err) {
      console.error('Resume routine failed:', err);
      setActionError("Resuming didn't go through. Try again.");
    } finally {
      setResuming(false);
    }
  };

  return (
    <section className="routine-today">
      <div className="routine-today-header">
        <DatePickerPill
          value={viewDate}
          onChange={setViewDate}
          heading="View day..."
        />
        {!paused && subtitleText && (
          <p className="routine-today-subtitle">{subtitleText}</p>
        )}
      </div>

      {actionError && <ErrorMessage message={actionError} />}

      {paused ? (
        <div className="routine-today-paused">
          <span className="material-icons routine-today-paused-icon" aria-hidden="true">
            bedtime
          </span>
          <h3 className="routine-today-paused-title">Routine paused</h3>
          <p className="routine-today-paused-body">
            Resumes {fromDateString(routine.pausedUntil).format('ddd, MMM D')}
          </p>
          <div className="routine-today-paused-actions">
            <button
              type="button"
              className="routine-today-paused-btn-secondary"
              onClick={() => onOpenPauseDialog?.(routine.pausedUntil)}
              disabled={resuming}
            >
              Change end date
            </button>
            <button
              type="button"
              className="routine-today-paused-btn-primary"
              onClick={handleResumeNow}
              disabled={resuming}
            >
              {resuming ? 'Resuming…' : 'Resume now'}
            </button>
          </div>
        </div>
      ) : hasNoRoutineYet ? (
        <div className="routine-today-onboarding">
          <h3 className="routine-today-onboarding-title">No routine yet</h3>
          <p className="routine-today-onboarding-body">
            Build the rhythms that keep things running.
          </p>
          <button
            type="button"
            className="routine-today-onboarding-cta"
            onClick={() => navigate('/routine-builder')}
          >
            Start building
          </button>
        </div>
      ) : totalCount === 0 ? (
        <div className="routine-today-empty">
          {isViewToday
            ? 'Your routine is clear today. Take the win.'
            : 'Quiet day — nothing scheduled.'}
        </div>
      ) : (
        BUCKETS.map((bucket) => {
          const list = groupedView[bucket.key];
          if (!list || list.length === 0) return null;
          const activeInBucket = list.filter(
            (m) => m.status === MISSION_STATUS.ACTIVE
          ).length;
          return (
            <div key={bucket.key} className="routine-today-group">
              <h3 className="routine-today-group-label">
                <span className="material-icons routine-today-group-icon">
                  {bucket.icon}
                </span>
                {bucket.label}
              </h3>
              <div className="routine-today-list">
                {list.map((mission) => (
                  <MissionCardCondensed
                    key={mission.id}
                    mission={mission}
                    hideRecurrenceBadge
                    hideRoutineBadge
                    onToggleComplete={handleToggleComplete}
                    onMissionChanged={onSaved}
                  />
                ))}
              </div>
              {isViewToday && activeInBucket > 0 && (
                <button
                  type="button"
                  className="routine-today-skip-btn"
                  onClick={() => handleSkipBucket(bucket.key)}
                >
                  Move remaining to tomorrow →
                </button>
              )}
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
