// src/components/routines/RoutineWeekGrid.jsx
import { useMemo } from 'react';
import dayjs from 'dayjs';
import {
  isMissionInRoutineSet,
  getMissionChainRoot,
} from '../../utils/routineHelpers';
import { isRecurringMission, RECURRENCE_PATTERNS } from '../../utils/recurrenceHelpers';
import { getHeatmapTier } from '../../utils/heatmapTier';
import './RoutineWeekGrid.css';

// Day numbering matches dayjs: 0=Sun, 1=Mon, …, 6=Sat. Short labels keep
// the column headers narrow on mobile; the full name is on aria-label so
// screen readers still get the long form.
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Build the column order starting from weekStartDay and wrapping. e.g.
// weekStartDay=1 → [Mon, Tue, Wed, Thu, Fri, Sat, Sun].
const buildColumnOrder = (weekStartDay) => {
  const start = Number.isFinite(weekStartDay) ? ((weekStartDay % 7) + 7) % 7 : 1;
  return Array.from({ length: 7 }, (_, i) => (start + i) % 7);
};

// Pattern-bound bucketing for weekly-pattern routine tasks.
//
//   - Tasks with `weekdays` set → one pill per weekday in the array.
//   - Tasks with empty `weekdays` (loose weekly) → land on whichever day
//     their `dueDate` currently falls on. This makes them draggable later
//     (the drag-to-formalize affordance we discussed in planning).
//
// Returns: { byDay: { 0: [missions], 1: [...], ... 6: [...] }, looseCount }
const bucketWeeklyMissions = (missions, routineRootSet, pausedRootSet) => {
  const byDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  let looseCount = 0;
  if (!Array.isArray(missions) || !routineRootSet) return { byDay, looseCount };

  for (const mission of missions) {
    if (!mission) continue;
    if (!isRecurringMission(mission)) continue;
    if (mission.recurrence?.pattern !== RECURRENCE_PATTERNS.WEEKLY) continue;
    if (!isMissionInRoutineSet(mission, routineRootSet)) continue;
    if (pausedRootSet) {
      const root = getMissionChainRoot(mission);
      if (root != null && pausedRootSet.has(root)) continue;
    }

    const weekdays = Array.isArray(mission.recurrence?.weekdays)
      ? mission.recurrence.weekdays.filter((d) => typeof d === 'number' && d >= 0 && d <= 6)
      : [];

    if (weekdays.length > 0) {
      for (const d of weekdays) {
        byDay[d].push(mission);
      }
    } else {
      // Loose weekly — anchor on the dueDate's weekday for now. If there's
      // no dueDate, count it as loose-uncolumned (rare; reserved for future
      // "Unscheduled" zone if it becomes a real problem).
      if (mission.dueDate) {
        const d = dayjs(mission.dueDate).day();
        byDay[d].push(mission);
        looseCount += 1;
      }
    }
  }

  return { byDay, looseCount };
};

const RoutineWeekGrid = ({
  missions,
  routineRootSet,
  pausedRootSet,
  weekStartDay = 1,
}) => {
  const columnOrder = useMemo(() => buildColumnOrder(weekStartDay), [weekStartDay]);
  const { byDay } = useMemo(
    () => bucketWeeklyMissions(missions, routineRootSet, pausedRootSet),
    [missions, routineRootSet, pausedRootSet]
  );

  const totalCount = columnOrder.reduce((acc, d) => acc + byDay[d].length, 0);

  if (totalCount === 0) {
    return (
      <div className="routine-week-grid is-empty">
        <p className="routine-week-grid-empty">
          No weekly routine tasks yet. Add some from the builder to see your
          week take shape.
        </p>
      </div>
    );
  }

  return (
    <div className="routine-week-grid">
      <div className="routine-week-grid-columns" role="list">
        {columnOrder.map((dayNum) => {
          const list = byDay[dayNum];
          const tier = getHeatmapTier(list.length);
          return (
            <div
              key={dayNum}
              className={`routine-week-col tier-${tier}`}
              role="listitem"
              aria-label={`${DAY_LONG[dayNum]}, ${list.length} ${list.length === 1 ? 'task' : 'tasks'}`}
            >
              <div className="routine-week-col-header">
                <span className="routine-week-col-day">{DAY_SHORT[dayNum]}</span>
                <span className="routine-week-col-count">{list.length}</span>
              </div>
              <div className="routine-week-col-body">
                {list.map((mission) => (
                  <div
                    key={`${dayNum}-${mission.id}`}
                    className="routine-week-pill"
                    title={mission.title}
                  >
                    {mission.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RoutineWeekGrid;
