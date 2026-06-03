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

  // Collapse adjacent Sat + Sun into a single "weekend pair" row when the
  // chosen weekStartDay puts them next to each other. With weekStartDay=Sun
  // they're at opposite ends of the display order — pairing the bookends
  // would feel wrong, so we just render normally.
  const renderableRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < columnOrder.length; i++) {
      const dayNum = columnOrder[i];
      const nextDayNum = columnOrder[i + 1];
      if (dayNum === 6 && nextDayNum === 0) {
        rows.push({ type: 'weekend' });
        i += 1;
      } else {
        rows.push({ type: 'day', dayNum });
      }
    }
    return rows;
  }, [columnOrder]);

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
      <div className="routine-week-rows" role="list">
        {renderableRows.map((row) => {
          if (row.type === 'weekend') {
            return (
              <WeekendPairRow
                key="weekend"
                satMissions={byDay[6]}
                sunMissions={byDay[0]}
              />
            );
          }
          return (
            <DayRow
              key={row.dayNum}
              dayNum={row.dayNum}
              missions={byDay[row.dayNum]}
            />
          );
        })}
      </div>
    </div>
  );
};

const DayRow = ({ dayNum, missions }) => {
  const tier = getHeatmapTier(missions.length);
  return (
    <div
      className={`routine-week-row tier-${tier}`}
      role="listitem"
      aria-label={`${DAY_LONG[dayNum]}, ${missions.length} ${missions.length === 1 ? 'task' : 'tasks'}`}
    >
      <div className="routine-week-row-label">
        <span className="routine-week-row-day">{DAY_SHORT[dayNum]}</span>
        <span className="routine-week-row-count">{missions.length}</span>
      </div>
      <div className="routine-week-row-body">
        {missions.length === 0 ? (
          <span className="routine-week-row-empty" aria-hidden="true">—</span>
        ) : (
          missions.map((mission) => (
            <div
              key={`${dayNum}-${mission.id}`}
              className="routine-week-pill"
              title={mission.title}
            >
              {mission.title}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Sat + Sun share a row when they sit next to each other in the column
// order. The pair container has no tint of its own; each half tints based
// on its own count, so a packed Saturday next to a clear Sunday still
// reads correctly. Internal layout is label-on-top + pills-below since
// the halves are too narrow on mobile for a side label rail.
const WeekendPairRow = ({ satMissions, sunMissions }) => {
  return (
    <div className="routine-week-row-pair" role="listitem" aria-label="Weekend">
      <WeekendHalf dayNum={6} missions={satMissions} />
      <WeekendHalf dayNum={0} missions={sunMissions} />
    </div>
  );
};

const WeekendHalf = ({ dayNum, missions }) => {
  const tier = getHeatmapTier(missions.length);
  return (
    <div
      className={`routine-week-half tier-${tier}`}
      aria-label={`${DAY_LONG[dayNum]}, ${missions.length} ${missions.length === 1 ? 'task' : 'tasks'}`}
    >
      <div className="routine-week-half-header">
        <span className="routine-week-half-day">{DAY_SHORT[dayNum]}</span>
        <span className="routine-week-half-count">{missions.length}</span>
      </div>
      <div className="routine-week-half-body">
        {missions.length === 0 ? (
          <span className="routine-week-row-empty" aria-hidden="true">—</span>
        ) : (
          missions.map((mission) => (
            <div
              key={`${dayNum}-${mission.id}`}
              className="routine-week-pill"
              title={mission.title}
            >
              {mission.title}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RoutineWeekGrid;
