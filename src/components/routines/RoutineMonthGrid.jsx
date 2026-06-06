// src/components/routines/RoutineMonthGrid.jsx
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
import {
  isRecurringMission,
  RECURRENCE_PATTERNS,
  getNthWeekdayOfMonth,
  getWeekdayOccurrenceInMonth,
} from '../../utils/recurrenceHelpers';
import { getHeatmapTier, computeLoadScore } from '../../utils/heatmapTier';
import { useAuth } from '../../contexts/AuthContext';
import {
  updateMission,
  uncompleteMission,
  completeMissionWithRecurrence,
} from '../../services/missionService';
import ErrorMessage from '../ui/ErrorMessage';
import MissionCardFull from '../missions/MissionCardFull';
import './RoutineMonthGrid.css';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Build the weekday-header order rotated to the user's chosen
// weekStartDay. Same convention as the week view.
const buildWeekdayOrder = (weekStartDay) => {
  const start = Number.isFinite(weekStartDay) ? ((weekStartDay % 7) + 7) % 7 : 1;
  return Array.from({ length: 7 }, (_, i) => (start + i) % 7);
};

// Build the calendar grid for a given month — leading days from the
// previous month to fill out the first week, then the month itself,
// then trailing days from the next month to complete the last week.
// Always lands on a multiple of 7 cells so the grid is clean.
const buildMonthCells = (displayedMonth, weekStartDay) => {
  const firstOfMonth = displayedMonth.startOf('month');
  const lastOfMonth = displayedMonth.endOf('month');

  const leading = (firstOfMonth.day() - weekStartDay + 7) % 7;
  const trailing = (weekStartDay - lastOfMonth.day() - 1 + 7) % 7;

  const start = firstOfMonth.subtract(leading, 'day');
  const total = leading + lastOfMonth.date() + trailing;

  const cells = [];
  for (let i = 0; i < total; i += 1) {
    const date = start.add(i, 'day');
    cells.push({
      date,
      isCurrentMonth: date.month() === displayedMonth.month(),
    });
  }
  return cells;
};

// Compute the placed date (dayjs) of a routine mission in the displayed
// month. dayOfMonth tasks clamp to the month's length (the 31st becomes
// Feb 28 / Apr 30). dayOfWeek tasks resolve via getNthWeekdayOfMonth.
// Returns null when there's no valid placement (e.g. missing fields).
const computePlacedDate = (mission, displayedMonth) => {
  const r = mission.recurrence;
  if (!r) return null;

  if (
    r.monthlyMode === 'dayOfWeek' &&
    r.weekOfMonth != null &&
    r.weekdayOfMonth != null
  ) {
    return getNthWeekdayOfMonth(displayedMonth, r.weekOfMonth, r.weekdayOfMonth);
  }
  if (r.dayOfMonth != null) {
    const clamped = Math.min(r.dayOfMonth, displayedMonth.daysInMonth());
    return displayedMonth.date(clamped);
  }
  // Fall back to mission.dueDate if it lives in the displayed month — covers
  // legacy data without explicit placement fields.
  if (mission.dueDate) {
    const due = dayjs(mission.dueDate);
    if (due.month() === displayedMonth.month() && due.year() === displayedMonth.year()) {
      return due;
    }
  }
  return null;
};

// Resolve effective recurrence — pending optimistic override wins over
// the persisted recurrence so a just-dropped task visibly lands in its
// new cell without waiting for the Firestore round trip.
const getEffectiveMission = (mission, pendingRecurrence) => {
  const override = pendingRecurrence?.get(mission.id);
  if (!override) return mission;
  return { ...mission, recurrence: { ...mission.recurrence, ...override } };
};

// Bucket monthly-pattern routine missions into the displayed month's
// cells, keyed by day-of-month (1-31). Out-of-month cells stay empty.
const bucketMonthlyMissions = (
  missions,
  displayedMonth,
  routineRootSet,
  pausedRootSet,
  pendingRecurrence
) => {
  const byDate = new Map();
  if (!Array.isArray(missions) || !routineRootSet) return byDate;

  for (const raw of missions) {
    if (!raw) continue;
    if (!isRecurringMission(raw)) continue;
    if (raw.recurrence?.pattern !== RECURRENCE_PATTERNS.MONTHLY) continue;
    if (!isMissionInRoutineSet(raw, routineRootSet)) continue;
    if (pausedRootSet) {
      const root = getMissionChainRoot(raw);
      if (root != null && pausedRootSet.has(root)) continue;
    }
    const mission = getEffectiveMission(raw, pendingRecurrence);
    const placed = computePlacedDate(mission, displayedMonth);
    if (!placed) continue;

    const key = placed.date();
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(mission);
  }

  return byDate;
};

const RoutineMonthGrid = ({
  missions,
  routineRootSet,
  pausedRootSet,
  weekStartDay = 1,
  onMutated,
}) => {
  const { currentUser } = useAuth();

  const [displayedMonth, setDisplayedMonth] = useState(() => dayjs().startOf('month'));
  const [pendingRecurrence, setPendingRecurrence] = useState(() => new Map());
  const [activeDrag, setActiveDrag] = useState(null);
  const [mutationError, setMutationError] = useState(null);
  const [editingMission, setEditingMission] = useState(null);

  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const weekdayOrder = useMemo(() => buildWeekdayOrder(weekStartDay), [weekStartDay]);
  const cells = useMemo(
    () => buildMonthCells(displayedMonth, weekStartDay),
    [displayedMonth, weekStartDay]
  );
  const byDate = useMemo(
    () => bucketMonthlyMissions(
      missions,
      displayedMonth,
      routineRootSet,
      pausedRootSet,
      pendingRecurrence
    ),
    [missions, displayedMonth, routineRootSet, pausedRootSet, pendingRecurrence]
  );

  // Max score across the displayed month — relative heatmap reference.
  const maxScore = useMemo(() => {
    let max = 0;
    byDate.forEach((dayMissions) => {
      const score = computeLoadScore(dayMissions);
      if (score > max) max = score;
    });
    return max;
  }, [byDate]);

  const today = useMemo(() => dayjs().startOf('day'), []);

  const handleDragStart = useCallback((event) => {
    const data = event.active?.data?.current;
    if (data) setActiveDrag(data);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  // Drag end — mode-preserving recurrence patch. dayOfMonth tasks
  // update dayOfMonth; dayOfWeek tasks update weekOfMonth + weekdayOfMonth.
  // Mode never flips just from a drag, so a "first Tuesday" task stays a
  // dayOfWeek task even when dropped on a cell that's also "the 7th."
  const handleDragEnd = useCallback(async (event) => {
    const dragData = event.active?.data?.current;
    const dropData = event.over?.data?.current;
    setActiveDrag(null);
    if (!dragData || !dropData) return;

    const { missionId, mission, sourceDate } = dragData;
    const targetDate = dropData.date;
    if (!targetDate) return;
    if (targetDate.isSame(sourceDate, 'day')) return;

    const mode = mission.recurrence?.monthlyMode || 'dayOfMonth';
    const recurrencePatch = {};
    if (mode === 'dayOfWeek') {
      recurrencePatch.weekdayOfMonth = targetDate.day();
      recurrencePatch.weekOfMonth = getWeekdayOccurrenceInMonth(targetDate);
    } else {
      recurrencePatch.dayOfMonth = targetDate.date();
    }

    setPendingRecurrence((prev) => {
      const next = new Map(prev);
      next.set(missionId, recurrencePatch);
      return next;
    });
    setMutationError(null);

    const newRecurrence = { ...mission.recurrence, ...recurrencePatch };
    const todayStr = dayjs().format('YYYY-MM-DD');
    const newDueDate =
      findNextOccurrenceOnOrAfter(todayStr, newRecurrence) || mission.dueDate;

    try {
      await updateMission(currentUser.uid, missionId, {
        recurrence: newRecurrence,
        dueDate: newDueDate,
      });
      await onMutated?.();
      setPendingRecurrence((prev) => {
        const next = new Map(prev);
        next.delete(missionId);
        return next;
      });
    } catch (err) {
      console.error('Routine month move failed:', err);
      setPendingRecurrence((prev) => {
        const next = new Map(prev);
        next.delete(missionId);
        return next;
      });
      setMutationError("That task didn't move. Try again.");
    }
  }, [currentUser, onMutated]);

  const handleBarOpen = useCallback((mission) => {
    setEditingMission(mission);
  }, []);

  const handleToggleComplete = useCallback(async (missionId, isCurrentlyCompleted) => {
    if (!currentUser) return;
    try {
      if (isCurrentlyCompleted) {
        await uncompleteMission(currentUser.uid, missionId);
      } else {
        await completeMissionWithRecurrence(currentUser.uid, missionId);
      }
      await onMutated?.();
    } catch (err) {
      console.error('Routine month toggle failed:', err);
    }
  }, [currentUser, onMutated]);

  const goPrev = () => setDisplayedMonth((m) => m.subtract(1, 'month'));
  const goNext = () => setDisplayedMonth((m) => m.add(1, 'month'));
  const goToday = () => setDisplayedMonth(dayjs().startOf('month'));

  const monthLabel = displayedMonth.format('MMMM YYYY');
  const isViewingThisMonth = displayedMonth.isSame(dayjs(), 'month');

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="routine-month-grid">
        <div className="routine-month-toolbar">
          <button
            type="button"
            className="routine-month-nav"
            onClick={goPrev}
            aria-label="Previous month"
          >
            <span className="material-icons">chevron_left</span>
          </button>
          <h2 className="routine-month-label">{monthLabel}</h2>
          <button
            type="button"
            className="routine-month-nav"
            onClick={goNext}
            aria-label="Next month"
          >
            <span className="material-icons">chevron_right</span>
          </button>
          {!isViewingThisMonth && (
            <button
              type="button"
              className="routine-month-today"
              onClick={goToday}
            >
              Today
            </button>
          )}
        </div>

        {mutationError && (
          <ErrorMessage message={mutationError} className="routine-month-error" />
        )}

        <div className="routine-month-weekday-row" aria-hidden="true">
          {weekdayOrder.map((d) => (
            <div key={d} className="routine-month-weekday">{WEEKDAY_SHORT[d]}</div>
          ))}
        </div>

        <div className="routine-month-cells">
          {cells.map((cell) => {
            const dateMissions = cell.isCurrentMonth
              ? (byDate.get(cell.date.date()) || [])
              : [];
            const tier = getHeatmapTier(computeLoadScore(dateMissions), maxScore);
            const isToday = cell.date.isSame(today, 'day');
            return (
              <CalendarCell
                key={cell.date.format('YYYY-MM-DD')}
                date={cell.date}
                missions={dateMissions}
                isCurrentMonth={cell.isCurrentMonth}
                isToday={isToday}
                tier={tier}
                onBarOpen={handleBarOpen}
              />
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div
            className="routine-month-bar is-drag-overlay"
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

// One cell in the calendar grid. Out-of-month cells fade and don't
// participate in drag (no useDroppable). In-month cells accept drops
// from any pill in the grid.
const CalendarCell = ({ date, missions, isCurrentMonth, isToday, tier, onBarOpen }) => {
  const droppableId = `cell-${date.format('YYYY-MM-DD')}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { date },
    disabled: !isCurrentMonth,
  });

  const classes = [
    'routine-month-cell',
    `tier-${tier}`,
    isCurrentMonth ? '' : 'is-out-of-month',
    isToday ? 'is-today' : '',
    isOver ? 'is-drop-target' : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={setNodeRef} className={classes}>
      <div className="routine-month-cell-date">{date.date()}</div>
      {isCurrentMonth && missions.length > 0 && (
        <div className="routine-month-cell-bars">
          {missions.map((mission) => (
            <DraggableBar
              key={`${date.format('YYYY-MM-DD')}-${mission.id}`}
              mission={mission}
              sourceDate={date}
              onOpen={onBarOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Compact difficulty-colored chip — the month-view equivalent of the
// week view's pill. Truncated title gives ~6-8 chars of preview at
// mobile cell widths; full title on hover via title attribute and on
// tap via MissionCardFull. Difficulty drives the chip background color
// (whole chip, not just a stripe — at this density the stripe
// disappears).
const DraggableBar = ({ mission, sourceDate, onOpen }) => {
  const dragId = `${mission.id}__${sourceDate.format('YYYY-MM-DD')}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: {
      missionId: mission.id,
      sourceDate,
      mission,
      title: mission.title,
    },
  });
  const handleClick = (e) => {
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
      className={`routine-month-bar ${isDragging ? 'is-dragging-source' : ''}`}
      data-difficulty={mission.difficulty || 'easy'}
      title={mission.title}
    >
      {mission.title}
    </div>
  );
};

export default RoutineMonthGrid;
