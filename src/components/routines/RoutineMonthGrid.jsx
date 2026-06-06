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
import MissionCardCondensed from '../missions/MissionCardCondensed';
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
  // The day currently surfaced in the bottom detail sheet. Tap a cell
  // with tasks → opens the sheet for that day. Tap the same cell again
  // → closes. Tap a different cell → switches focus.
  const [focusedDate, setFocusedDate] = useState(null);

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

  // isDragActive doubles as a "soft-close" signal for the detail sheet
  // — while a pill is in flight, the sheet fades and stops intercepting
  // pointers so cells behind it become reachable drop targets.
  const isDragActive = activeDrag !== null;

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

  const handleCellClick = useCallback((date, dateMissions) => {
    if (!dateMissions || dateMissions.length === 0) {
      // Tap-empty closes any open sheet so the calendar reads quiet.
      setFocusedDate(null);
      return;
    }
    setFocusedDate((prev) => (prev && prev.isSame(date, 'day') ? null : date));
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

  // Effective missions for the focused day — reads through the pending
  // overlay so when a task is dragged out of the focused day onto a
  // different cell, the sheet's list updates immediately.
  const focusedMissions = focusedDate
    ? (byDate.get(focusedDate.date()) || [])
    : [];

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
            const isFocused = focusedDate && focusedDate.isSame(cell.date, 'day');
            return (
              <CalendarCell
                key={cell.date.format('YYYY-MM-DD')}
                date={cell.date}
                missions={dateMissions}
                isCurrentMonth={cell.isCurrentMonth}
                isToday={isToday}
                isFocused={isFocused}
                tier={tier}
                onClick={handleCellClick}
              />
            );
          })}
        </div>
      </div>

      {focusedDate && (
        <MonthDayDetailSheet
          date={focusedDate}
          missions={focusedMissions}
          isDragActive={isDragActive}
          onClose={() => setFocusedDate(null)}
          onToggleComplete={handleToggleComplete}
          onMissionChanged={onMutated}
        />
      )}

      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div
            className="routine-month-pill is-drag-overlay"
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

// One cell in the calendar grid. Shows date + heatmap tint + a small
// difficulty-dot summary that doubles as count signal. Tapping the cell
// surfaces the day's full task list in the bottom detail sheet (where
// pills are draggable). Out-of-month cells fade and don't participate
// in drag or click.
const CalendarCell = ({
  date,
  missions,
  isCurrentMonth,
  isToday,
  isFocused,
  tier,
  onClick,
}) => {
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
    isFocused ? 'is-focused' : '',
    isOver ? 'is-drop-target' : '',
    missions.length > 0 && isCurrentMonth ? 'has-tasks' : '',
  ].filter(Boolean).join(' ');

  const handleClick = () => {
    if (!isCurrentMonth) return;
    onClick?.(date, missions);
  };

  return (
    <div
      ref={setNodeRef}
      className={classes}
      onClick={handleClick}
      role={isCurrentMonth ? 'button' : undefined}
      tabIndex={isCurrentMonth ? 0 : undefined}
      onKeyDown={
        isCurrentMonth
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      <div className="routine-month-cell-date">{date.date()}</div>
      {isCurrentMonth && missions.length > 0 && (
        <CellSummary missions={missions} />
      )}
    </div>
  );
};

// Literal count — accessible (a number is unambiguous to screen
// readers and low-vision users) and faster to parse than a row of
// dots. Heatmap tint already carries the relative-load signal; the
// count provides the absolute. aria-label spells it out for AT.
const CellSummary = ({ missions }) => {
  const count = missions.length;
  return (
    <div
      className="routine-month-cell-count"
      aria-label={`${count} ${count === 1 ? 'task' : 'tasks'}`}
    >
      {count}
    </div>
  );
};

// Bottom sheet — anchored to the bottom of the viewport, no backdrop so
// the calendar stays visible (and droppable) above. Renders the focused
// day's missions using the same MissionCardCondensed cards the rest of
// the app uses, with a drag handle on the right side (same pattern as
// SortableRoutineCard). Tap card body → MissionCardFull. Drag handle →
// move to a different cell.
//
// During a drag the sheet soft-closes — fades to a faint silhouette and
// drops pointer-events — so cells behind it become reachable drop targets
// for the in-flight pill without forcing the user to dismiss and reopen.
const MonthDayDetailSheet = ({
  date,
  missions,
  isDragActive,
  onClose,
  onToggleComplete,
  onMissionChanged,
}) => {
  const dateLabel = date.format('dddd, MMMM D');
  return (
    <div
      className={`routine-month-sheet ${isDragActive ? 'is-soft-closed' : ''}`}
      role="dialog"
      aria-label={dateLabel}
    >
      <div className="routine-month-sheet-header">
        <h3 className="routine-month-sheet-title">{dateLabel}</h3>
        <button
          type="button"
          className="routine-month-sheet-close"
          onClick={onClose}
          aria-label="Close"
        >
          <span className="material-icons">close</span>
        </button>
      </div>
      <div className="routine-month-sheet-body">
        {missions.length === 0 ? (
          <p className="routine-month-sheet-empty">
            All tasks moved off this day.
          </p>
        ) : (
          missions.map((mission) => (
            <DraggableMissionCard
              key={mission.id}
              mission={mission}
              sourceDate={date}
              onToggleComplete={onToggleComplete}
              onMissionChanged={onMissionChanged}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Wraps MissionCardCondensed with a drag handle on the right side —
// mirrors SortableRoutineCard, but uses useDraggable (cross-container
// drag onto a calendar cell) instead of useSortable (within-list
// reorder). Card body keeps its normal tap-to-edit behavior; only the
// handle initiates drag.
const DraggableMissionCard = ({
  mission,
  sourceDate,
  onToggleComplete,
  onMissionChanged,
}) => {
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

  const dragHandle = (
    <button
      type="button"
      className="routine-month-drag-handle"
      {...attributes}
      {...listeners}
      style={{ touchAction: 'none' }}
      aria-label="Drag to move task"
      title="Drag to move"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="material-icons">drag_indicator</span>
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      className={`routine-month-card-wrap ${isDragging ? 'is-dragging-source' : ''}`}
    >
      <MissionCardCondensed
        mission={mission}
        onToggleComplete={onToggleComplete}
        onMissionChanged={onMissionChanged}
        hideRoutineBadge
        actionSlot={dragHandle}
      />
    </div>
  );
};

export default RoutineMonthGrid;
