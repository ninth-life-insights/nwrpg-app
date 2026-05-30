// src/components/routines/RoutineTodaySection.jsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import AchievementToast from '../achievements/AchievementToast';
import ErrorMessage from '../ui/ErrorMessage';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  uncompleteMission,
  completeMissionWithRecurrence,
  updateMission,
} from '../../services/missionService';
import {
  getRoutineMissionsForDate,
  groupRoutineMissionsByFrequency,
} from '../../utils/routineHelpers';
import { fromDateString } from '../../utils/dateHelpers';
import { MISSION_STATUS } from '../../types/Mission';
import './RoutineTodaySection.css';

const BUCKETS = [
  { key: 'daily',   label: 'Daily' },
  { key: 'weekly',  label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly',  label: 'Yearly' },
];

// "Today" surface for the routine page — the action view. The date-picker
// pill mirrors EditDailyMissionsPage's pattern so users have one consistent
// "switch the day I'm looking at" affordance across the app. Today's view
// also surfaces completed-today items so progress through the day stays
// visible.
const RoutineTodaySection = ({ missions, routineRootSet, onSaved }) => {
  const { currentUser } = useAuth();
  const { notifyMissionCompletion } = useNotifications();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState(null);
  const [newAchievements, setNewAchievements] = useState([]);
  const [viewDate, setViewDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const todayString = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const tomorrowString = useMemo(
    () => dayjs().add(1, 'day').format('YYYY-MM-DD'),
    []
  );
  const isViewToday = viewDate === todayString;
  const isViewTomorrow = viewDate === tomorrowString;

  // Match EditDailyMissionsPage's pill label format exactly.
  const viewDateDisplay = isViewToday
    ? `Today — ${fromDateString(viewDate).format('ddd, MMM D')}`
    : isViewTomorrow
    ? `Tomorrow — ${fromDateString(viewDate).format('ddd, MMM D')}`
    : fromDateString(viewDate).format('ddd, MMM D');

  const viewMissions = useMemo(
    () => getRoutineMissionsForDate(missions, routineRootSet, viewDate),
    [missions, routineRootSet, viewDate]
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

  const handleDateSelect = (newDate) => {
    setViewDate(newDate);
    setShowDatePicker(false);
  };

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

  return (
    <section className="routine-today">
      <div className="routine-today-header">
        <button
          type="button"
          className={`date-selector-pill ${!isViewToday ? 'future' : ''}`}
          onClick={() => setShowDatePicker(true)}
          aria-label="Change view date"
        >
          <span className="date-selector-icon">📅</span>
          <span className="date-selector-label">{viewDateDisplay}</span>
          <span className="date-selector-caret">▾</span>
        </button>
        {subtitleText && (
          <p className="routine-today-subtitle">{subtitleText}</p>
        )}
      </div>

      {actionError && <ErrorMessage message={actionError} />}

      {hasNoRoutineYet ? (
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
            : 'Nothing on your routine for this day.'}
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

      {/* Date picker — same UX as the daily planning page */}
      {showDatePicker && (
        <div className="date-picker-overlay" onClick={() => setShowDatePicker(false)}>
          <div className="date-picker-sheet" onClick={(e) => e.stopPropagation()}>
            <p className="date-picker-heading">View day...</p>
            <button
              className={`date-picker-option ${viewDate === todayString ? 'active' : ''}`}
              onClick={() => handleDateSelect(todayString)}
            >
              Today — {fromDateString(todayString).format('ddd, MMM D')}
            </button>
            <button
              className={`date-picker-option ${viewDate === tomorrowString ? 'active' : ''}`}
              onClick={() => handleDateSelect(tomorrowString)}
            >
              Tomorrow — {fromDateString(tomorrowString).format('ddd, MMM D')}
            </button>
            <div className="date-picker-custom">
              <label className="date-picker-custom-label" htmlFor="routine-view-date-input">
                Choose a date
              </label>
              <input
                id="routine-view-date-input"
                type="date"
                className="date-picker-input"
                min={todayString}
                defaultValue={
                  viewDate !== todayString && viewDate !== tomorrowString
                    ? viewDate
                    : ''
                }
                onChange={(e) => {
                  if (e.target.value) handleDateSelect(e.target.value);
                }}
              />
            </div>
            <button
              className="date-picker-cancel"
              onClick={() => setShowDatePicker(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default RoutineTodaySection;
