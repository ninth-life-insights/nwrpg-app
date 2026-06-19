// src/components/routines/RoutineWeekGrid.jsx
import { useMemo, useState, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  isMissionInRoutineSet,
  getMissionChainRoot,
  findNextOccurrenceOnOrAfter,
} from '../../utils/routineHelpers';
import { isRecurringMission, RECURRENCE_PATTERNS } from '../../utils/recurrenceHelpers';
import { getHeatmapTier, computeLoadScore } from '../../utils/heatmapTier';
import { useAuth } from '../../contexts/AuthContext';
import {
  updateMission,
  uncompleteMission,
} from '../../services/missionService';
import { useMissionCompletion } from '../../contexts/MissionCompletionContext';
import ErrorMessage from '../ui/ErrorMessage';
import MissionCardFull from '../missions/MissionCardFull';
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

// Resolve a mission's effective weekdays, preferring an optimistic
// override (pending drop) over the persisted recurrence.weekdays. Returns
// a sanitized integer array.
const getEffectiveWeekdays = (mission, pendingOverrides) => {
  const override = pendingOverrides?.get(mission.id);
  const source = override ?? mission.recurrence?.weekdays;
  return Array.isArray(source)
    ? source.filter((d) => typeof d === 'number' && d >= 0 && d <= 6)
    : [];
};

// Pattern-bound bucketing for weekly-pattern routine tasks.
//
//   - Tasks with `weekdays` set → one pill per weekday in the array.
//   - Tasks with empty `weekdays` (loose weekly) → land on whichever day
//     their `dueDate` currently falls on. Dragging a loose-weekly task
//     formalizes it into a single-weekday cadence.
//
// Pending optimistic overrides (post-drop, pre-Firestore round trip) win
// over the persisted weekdays so the pill visibly lands where the user
// dropped it without waiting for the refresh.
const bucketWeeklyMissions = (missions, routineRootSet, pausedRootSet, pendingOverrides) => {
  const byDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  if (!Array.isArray(missions) || !routineRootSet) return { byDay };

  for (const mission of missions) {
    if (!mission) continue;
    if (!isRecurringMission(mission)) continue;
    if (mission.recurrence?.pattern !== RECURRENCE_PATTERNS.WEEKLY) continue;
    if (!isMissionInRoutineSet(mission, routineRootSet)) continue;
    if (pausedRootSet) {
      const root = getMissionChainRoot(mission);
      if (root != null && pausedRootSet.has(root)) continue;
    }

    const weekdays = getEffectiveWeekdays(mission, pendingOverrides);

    if (weekdays.length > 0) {
      for (const d of weekdays) {
        byDay[d].push(mission);
      }
    } else if (mission.dueDate) {
      // Loose weekly — anchor on the dueDate's weekday.
      const d = dayjs(mission.dueDate).day();
      byDay[d].push(mission);
    }
  }

  return { byDay };
};

// Compute the new weekdays array given a drag's source and target day.
// Single-weekday: replace. Multi-weekday: remove source, add target,
// dedup. Loose-weekly ([]): formalize to [target].
const computeNewWeekdays = (currentWeekdays, sourceDayNum, targetDayNum) => {
  if (!Array.isArray(currentWeekdays) || currentWeekdays.length === 0) {
    return [targetDayNum];
  }
  const set = new Set(currentWeekdays);
  set.delete(sourceDayNum);
  set.add(targetDayNum);
  return Array.from(set).sort((a, b) => a - b);
};

const RoutineWeekGrid = ({
  missions,
  routineRootSet,
  pausedRootSet,
  weekStartDay = 1,
  onMutated,
}) => {
  const { currentUser } = useAuth();
  const { completeMission: completeMissionOptimistic } = useMissionCompletion();
  // Optimistic pending state — keyed by missionId, holds the post-drop
  // weekdays so the UI reflects the move without waiting for Firestore.
  // Cleared once the next refresh's prop data carries the same change.
  const [pendingWeekdays, setPendingWeekdays] = useState(() => new Map());
  const [activeDrag, setActiveDrag] = useState(null);
  const [mutationError, setMutationError] = useState(null);
  // Mission currently open in the MissionCardFull modal — opened by a
  // tap on a pill, edited inline, closed without disrupting the grid's
  // layout. Tap vs drag is resolved by @dnd-kit's activation constraints
  // (a click without 8px of movement / 150ms of touch hold doesn't trigger
  // a drag), so the same pill is both clickable and draggable cleanly.
  const [editingMission, setEditingMission] = useState(null);

  // Drag sensors mirror the builder's: long-press on touch (lets tap
  // pass through), distance threshold on pointer (no accidental drags).
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const columnOrder = useMemo(() => buildColumnOrder(weekStartDay), [weekStartDay]);
  const { byDay } = useMemo(
    () => bucketWeeklyMissions(missions, routineRootSet, pausedRootSet, pendingWeekdays),
    [missions, routineRootSet, pausedRootSet, pendingWeekdays]
  );

  // Busiest day across all 7 (treating weekend pair as two independent
  // days). Drives the relative heatmap so a sparse week and a packed
  // week both use the full color range.
  const maxScore = useMemo(() => {
    let max = 0;
    for (let d = 0; d <= 6; d += 1) {
      const score = computeLoadScore(byDay[d]);
      if (score > max) max = score;
    }
    return max;
  }, [byDay]);

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

  const handleDragStart = useCallback((event) => {
    const data = event.active?.data?.current;
    if (data) setActiveDrag(data);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  const handleDragEnd = useCallback(async (event) => {
    const dragData = event.active?.data?.current;
    const dropData = event.over?.data?.current;
    setActiveDrag(null);
    if (!dragData || !dropData) return;

    const { missionId, sourceDayNum, mission } = dragData;
    const targetDayNum = dropData.dayNum;
    if (typeof targetDayNum !== 'number') return;
    if (sourceDayNum === targetDayNum) return;

    // Compute the new weekdays from whatever the user sees right now
    // (existing pending override wins so chained drags compose).
    const currentWeekdays = pendingWeekdays.get(missionId)
      ?? mission.recurrence?.weekdays
      ?? [];
    const newWeekdays = computeNewWeekdays(currentWeekdays, sourceDayNum, targetDayNum);

    // Optimistic apply — the UI flips before the round trip lands.
    setPendingWeekdays((prev) => {
      const next = new Map(prev);
      next.set(missionId, newWeekdays);
      return next;
    });
    setMutationError(null);

    // Build the full recurrence (Firestore overwrites nested objects)
    // and snap dueDate to the next occurrence under the new cadence.
    const newRecurrence = { ...mission.recurrence, weekdays: newWeekdays };
    const todayStr = dayjs().format('YYYY-MM-DD');
    const newDueDate =
      findNextOccurrenceOnOrAfter(todayStr, newRecurrence) || mission.dueDate;

    try {
      await updateMission(currentUser.uid, missionId, {
        recurrence: newRecurrence,
        dueDate: newDueDate,
      });
      await onMutated?.();
      // Clear the override — the refreshed prop data now carries the change.
      setPendingWeekdays((prev) => {
        const next = new Map(prev);
        next.delete(missionId);
        return next;
      });
    } catch (err) {
      console.error('Routine task move failed:', err);
      // Revert optimistic state on error.
      setPendingWeekdays((prev) => {
        const next = new Map(prev);
        next.delete(missionId);
        return next;
      });
      setMutationError("That task didn't move. Try again.");
    }
  }, [currentUser, onMutated, pendingWeekdays]);

  const handlePillOpen = useCallback((mission) => {
    setEditingMission(mission);
  }, []);

  // Toggle handler mirrors RoutineTodaySection — completion from the
  // week view spawns the next instance via the same flow as elsewhere,
  // so a "I already did this" click from the planning view stays
  // consistent with the rest of the app.
  const handleToggleComplete = useCallback(async (missionId, isCurrentlyCompleted) => {
    if (!currentUser) return;
    if (isCurrentlyCompleted) {
      try {
        await uncompleteMission(currentUser.uid, missionId);
        await onMutated?.();
      } catch (err) {
        console.error('Routine week uncomplete failed:', err);
      }
      return;
    }
    completeMissionOptimistic(missionId, null, {
      onResolved: async () => { await onMutated?.(); },
    });
  }, [currentUser, onMutated, completeMissionOptimistic]);

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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="routine-week-grid">
        {mutationError && (
          <ErrorMessage message={mutationError} className="routine-week-grid-error" />
        )}
        <div className="routine-week-rows" role="list">
          {renderableRows.map((row) => {
            if (row.type === 'weekend') {
              return (
                <WeekendPairRow
                  key="weekend"
                  satMissions={byDay[6]}
                  sunMissions={byDay[0]}
                  maxScore={maxScore}
                  onPillOpen={handlePillOpen}
                />
              );
            }
            return (
              <DayRow
                key={row.dayNum}
                dayNum={row.dayNum}
                missions={byDay[row.dayNum]}
                maxScore={maxScore}
                onPillOpen={handlePillOpen}
              />
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div
            className="routine-week-pill is-drag-overlay"
            data-difficulty={activeDrag.mission?.difficulty || 'easy'}
          >
            {activeDrag.title}
          </div>
        ) : null}
      </DragOverlay>

      {editingMission && (
        <MissionCardFull
          mission={editingMission}
          onClose={() => setEditingMission(null)}
          onToggleComplete={handleToggleComplete}
          onMissionChanged={onMutated}
        />
      )}
    </DndContext>
  );
};

const DayRow = ({ dayNum, missions, maxScore, onPillOpen }) => {
  const tier = getHeatmapTier(computeLoadScore(missions), maxScore);
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayNum}`,
    data: { dayNum },
  });
  return (
    <div
      ref={setNodeRef}
      className={`routine-week-row tier-${tier} ${isOver ? 'is-drop-target' : ''}`}
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
            <DraggablePill
              key={`${dayNum}-${mission.id}`}
              mission={mission}
              dayNum={dayNum}
              onOpen={onPillOpen}
            />
          ))
        )}
      </div>
    </div>
  );
};

const WeekendPairRow = ({ satMissions, sunMissions, maxScore, onPillOpen }) => {
  return (
    <div
      className="routine-week-row-pair"
      role="listitem"
      aria-label="Weekend"
    >
      <WeekendHalf dayNum={6} missions={satMissions} maxScore={maxScore} onPillOpen={onPillOpen} />
      <WeekendHalf dayNum={0} missions={sunMissions} maxScore={maxScore} onPillOpen={onPillOpen} />
    </div>
  );
};

const WeekendHalf = ({ dayNum, missions, maxScore, onPillOpen }) => {
  const tier = getHeatmapTier(computeLoadScore(missions), maxScore);
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayNum}`,
    data: { dayNum },
  });
  return (
    <div
      ref={setNodeRef}
      className={`routine-week-half tier-${tier} ${isOver ? 'is-drop-target' : ''}`}
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
            <DraggablePill
              key={`${dayNum}-${mission.id}`}
              mission={mission}
              dayNum={dayNum}
              onOpen={onPillOpen}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Each pill is its own draggable. Identity baked into the id keeps
// multi-weekday tasks distinct — dragging the Wed pill doesn't move the
// Mon and Fri pills of the same mission. Also tap-to-open: the @dnd-kit
// activation constraints (8px pointer / 150ms touch) mean a click
// without movement falls through to onClick, so the same pill is both
// draggable and clickable cleanly.
const DraggablePill = ({ mission, dayNum, onOpen }) => {
  const dragId = `${mission.id}__${dayNum}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: {
      missionId: mission.id,
      sourceDayNum: dayNum,
      mission,
      title: mission.title,
    },
  });
  const handleClick = (e) => {
    // Defensive: if a drag was in flight, don't also open the modal.
    if (isDragging) return;
    e.stopPropagation();
    onOpen?.(mission);
  };
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`routine-week-pill ${isDragging ? 'is-dragging-source' : ''}`}
      data-difficulty={mission.difficulty || 'easy'}
      title={mission.title}
    >
      {mission.title}
    </div>
  );
};

export default RoutineWeekGrid;
