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
import { MISSION_STATUS } from '../../types/Mission';
import './RoutineTodaySection.css';

const BUCKETS = [
  { key: 'daily',   label: 'Daily' },
  { key: 'weekly',  label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly',  label: 'Yearly' },
];

// Build the date-selector options: today + 6 days ahead. Labels lean on
// natural language ("Today", "Tomorrow") for the near days, then weekday
// names — weekday names don't collide within a 7-day window so they're
// unambiguous.
const buildDateOptions = () => {
  const opts = [];
  for (let i = 0; i < 7; i++) {
    const d = dayjs().add(i, 'day');
    let label;
    if (i === 0) label = 'Today';
    else if (i === 1) label = 'Tomorrow';
    else label = d.format('dddd');
    opts.push({ value: d.format('YYYY-MM-DD'), label });
  }
  return opts;
};

// "Today" surface for the routine page — the action view. Date-aware: a
// dropdown lets her peek at upcoming days. Today's view also surfaces
// completed-today items so she can see progress through the day rather than
// items vanishing on completion.
const RoutineTodaySection = ({ missions, routineRootSet, onSaved }) => {
  const { currentUser } = useAuth();
  const { notifyMissionCompletion } = useNotifications();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState(null);
  const [newAchievements, setNewAchievements] = useState([]);
  const [viewDate, setViewDate] = useState(() => dayjs().format('YYYY-MM-DD'));

  const dateOptions = useMemo(() => buildDateOptions(), []);
  const todayString = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const isToday = viewDate === todayString;

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
  const allDone = isToday && totalCount > 0 && activeCount === 0;

  // Subtitle text: date + a context-appropriate count phrase.
  const subtitleText = useMemo(() => {
    const dateLabel = dayjs(viewDate).format('dddd, MMM D');
    if (isToday) {
      if (totalCount === 0) return dateLabel;
      if (activeCount === 0) return `${dateLabel} · All done`;
      if (completedCount === 0) return `${dateLabel} · ${activeCount} to do`;
      return `${dateLabel} · ${completedCount} of ${totalCount} done`;
    }
    if (totalCount === 0) return `${dateLabel} · Nothing scheduled`;
    return `${dateLabel} · ${totalCount} scheduled`;
  }, [viewDate, isToday, totalCount, activeCount, completedCount]);

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
        <div className="routine-today-date-row">
          <select
            className="routine-today-date-select"
            value={viewDate}
            onChange={(e) => setViewDate(e.target.value)}
            aria-label="Select day"
          >
            {dateOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {allDone && (
            <span className="routine-today-celebrate" aria-hidden="true">🎉</span>
          )}
        </div>
        <p className="routine-today-subtitle">{subtitleText}</p>
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
          {isToday
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
              {isToday && activeInBucket > 0 && (
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
