// src/utils/recurrenceHelpers.js
import { DUE_TYPES } from '../types/Mission';
import dayjs from 'dayjs';

export const RECURRENCE_PATTERNS = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  CUSTOM: 'custom'
};

// Check if mission is recurring
export const isRecurringMission = (mission) => {
  return mission.dueType === DUE_TYPES.RECURRING;
};

// Check if mission is evergreen
export const isEvergreenMission = (mission) => {
  return mission.dueType === DUE_TYPES.EVERGREEN;
};

const WEEKDAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_OF_MONTH_LABELS = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', '-1': 'last' };

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Inverse of getNthWeekdayOfMonth — "March 17 is the 3rd Tuesday."
// Returns 1-4 for the 1st-4th occurrence of the date's weekday in its
// month, or -1 ("last") for the 5th-and-final occurrence. The recurrence
// schema only stores 1|2|3|4|-1 (no 5), so day 29+ always maps to -1
// to keep behavior stable across month lengths. Used by the month
// view's drag handler when a dayOfWeek-mode task is dropped on a new
// cell — target.date() → new weekOfMonth via this helper.
export const getWeekdayOccurrenceInMonth = (date) => {
  const d = dayjs(date);
  const occurrence = Math.ceil(d.date() / 7);
  return occurrence >= 5 ? -1 : occurrence;
};

// Find the nth occurrence of a weekday in a given month.
// ordinal: 1, 2, 3, 4, or -1 (last). weekday: 0 (Sun) - 6 (Sat).
// monthDayjs: any dayjs date inside the target month.
// Returns a dayjs object.
export const getNthWeekdayOfMonth = (monthDayjs, ordinal, weekday) => {
  if (ordinal === -1) {
    // Last occurrence — walk back from the end of the month
    const lastDay = monthDayjs.endOf('month');
    const diff = (lastDay.day() - weekday + 7) % 7;
    return lastDay.subtract(diff, 'day');
  }
  // First occurrence
  const firstDay = monthDayjs.startOf('month');
  const offset = (weekday - firstDay.day() + 7) % 7;
  const first = firstDay.add(offset, 'day');
  // Then advance (ordinal - 1) weeks. If the result spills into the next month
  // (e.g. asking for "5th Friday" in a 4-Friday month), clamp to the last
  // matching weekday so we never silently return the next month.
  const candidate = first.add(ordinal - 1, 'week');
  if (candidate.month() !== monthDayjs.month()) {
    return getNthWeekdayOfMonth(monthDayjs, -1, weekday);
  }
  return candidate;
};

// Format a recurrence object into a human-readable string. Used by both the
// mission card badge and the recurrence selector preview — one source of truth.
//
// Pass `{ verbose: true }` for detail-view contexts (form preview, MissionCardFull):
// includes the day-of-month or day-of-week detail for monthly. Default (short)
// drops that detail since at-a-glance badges don't need it.
export const formatRecurrence = (recurrence, { verbose = false } = {}) => {
  if (!recurrence || !recurrence.pattern || recurrence.pattern === RECURRENCE_PATTERNS.NONE) {
    return null;
  }
  const { pattern, interval = 1, weekdays = [], dayOfMonth } = recurrence;
  const n = Math.max(1, interval);

  switch (pattern) {
    case 'daily':
      return n === 1 ? 'Every day' : `Every ${n} days`;

    case 'weekly': {
      const sortedDays = [...weekdays].sort((a, b) => a - b);

      // 7 days = "every day". 0 or 1 day = just "Every week" (the specific day
      // is implied by the due date; saying it twice is noise). Only show the
      // day list when there are multiple, since that's when it carries info.
      if (sortedDays.length === 7) {
        return n === 1 ? 'Every day' : `Every ${n} weeks`;
      }
      if (sortedDays.length <= 1) {
        return n === 1 ? 'Every week' : `Every ${n} weeks`;
      }
      const dayList = sortedDays.map(d => WEEKDAY_NAMES_SHORT[d]).join(', ');
      return n === 1 ? `Every ${dayList}` : `Every ${n} weeks on ${dayList}`;
    }

    case 'monthly': {
      const base = n === 1 ? 'Every month' : `Every ${n} months`;
      if (!verbose) return base;
      if (recurrence.monthlyMode === 'dayOfWeek'
        && recurrence.weekOfMonth != null
        && recurrence.weekdayOfMonth != null) {
        const ord = WEEK_OF_MONTH_LABELS[String(recurrence.weekOfMonth)] || ordinal(recurrence.weekOfMonth);
        const day = WEEKDAY_NAMES_FULL[recurrence.weekdayOfMonth];
        return `${base} on the ${ord} ${day}`;
      }
      return dayOfMonth ? `${base} on the ${ordinal(dayOfMonth)}` : base;
    }

    case 'yearly':
      return n === 1 ? 'Every year' : `Every ${n} years`;

    default:
      return 'Recurring';
  }
};

// Mission-shaped wrapper for `formatRecurrence`. Kept for the mission card
// badge, which receives a mission object. Pass `{ verbose: true }` for the
// detail view (MissionCardFull) where the day-of-month/day-of-week detail
// belongs.
export const getRecurrenceDisplayText = (mission, options) => {
  if (!isRecurringMission(mission)) return null;
  return formatRecurrence(mission.recurrence, options) || 'Recurring';
};

// Calculate the next due date based on recurrence pattern
export const calculateNextDueDate = (currentDueDate, recurrence) => {
  if (!recurrence || recurrence.pattern === RECURRENCE_PATTERNS.NONE) {
    return null;
  }

  const current = dayjs(currentDueDate);
  const { pattern, interval, weekdays, dayOfMonth } = recurrence;

  switch (pattern) {
    case RECURRENCE_PATTERNS.DAILY:
    case 'daily': // Support both formats
      return current.add(interval, 'day').format('YYYY-MM-DD');

      case RECURRENCE_PATTERNS.WEEKLY:
      if (weekdays && weekdays.length > 0) {
        // Find the next occurrence of any selected weekday
        let nextDate = current.add(1, 'day');
        let daysChecked = 0;

        while (daysChecked < 7 && !weekdays.includes(nextDate.day())) {
          nextDate = nextDate.add(1, 'day');
          daysChecked++;
        }

        if (weekdays.includes(nextDate.day())) {
          // For interval > 1 ("every N weeks on [days]"), only apply the gap
          // when the next match has crossed into a new calendar week. This
          // preserves multi-day-per-week patterns: "every 2 weeks on Mon, Wed"
          // means M and W in week 0, skip to M and W in week 2 — not M then
          // Wed-of-next-week.
          const nextDateInNewWeek = !nextDate.startOf('week').isSame(current.startOf('week'), 'day');
          if (interval > 1 && nextDateInNewWeek) {
            nextDate = nextDate.add(interval - 1, 'week');
          }
          return nextDate.format('YYYY-MM-DD');
        }
      }
      // Fallback to simple weekly interval
      return current.add(interval, 'week').format('YYYY-MM-DD');

    case RECURRENCE_PATTERNS.MONTHLY: {
      const nextMonth = current.add(interval, 'month');
      // Day-of-week mode: "the 2nd Tuesday of every month".
      if (recurrence.monthlyMode === 'dayOfWeek'
        && recurrence.weekOfMonth != null
        && recurrence.weekdayOfMonth != null) {
        return getNthWeekdayOfMonth(nextMonth, recurrence.weekOfMonth, recurrence.weekdayOfMonth).format('YYYY-MM-DD');
      }
      // Day-of-month mode (default). dayOfMonth carries the user's intended
      // day; if missing (legacy data), fall back to current.date(). Always cap
      // to the target month's length so the 31st collapses to 28/30 in short
      // months but jumps back to 31 whenever a 31-day month appears.
      const targetDay = Math.min(dayOfMonth || current.date(), nextMonth.daysInMonth());
      return nextMonth.date(targetDay).format('YYYY-MM-DD');
    }
      
    case RECURRENCE_PATTERNS.YEARLY:
    case 'yearly':
      return current.add(interval, 'year').format('YYYY-MM-DD');

    default:
      return null;
  }
};

// Completion-anchored next-due calculation. Implements the snap-to-weekday/
// day-of-month rule: when the recurrence shape names a specific calendar day,
// the next instance lands on the next matching day strictly after completion,
// then adds (interval - 1) cycles to honor the cadence. When the shape has no
// specific day (pure cadence), it's just `interval` units forward from the
// completion date.
//
// completionDateString: YYYY-MM-DD (the date the mission was checked off)
export const calculateNextDueDateFromCompletion = (completionDateString, recurrence) => {
  if (!recurrence || recurrence.pattern === RECURRENCE_PATTERNS.NONE) return null;

  const completion = dayjs(completionDateString);
  const { pattern, interval = 1, weekdays = [], dayOfMonth } = recurrence;
  const n = Math.max(1, interval);

  switch (pattern) {
    case RECURRENCE_PATTERNS.DAILY:
    case 'daily':
      return completion.add(n, 'day').format('YYYY-MM-DD');

    case RECURRENCE_PATTERNS.WEEKLY: {
      if (weekdays && weekdays.length > 0) {
        // Snap forward to the next matching weekday strictly after completion.
        let nextDate = completion.add(1, 'day');
        let daysChecked = 0;
        while (daysChecked < 7 && !weekdays.includes(nextDate.day())) {
          nextDate = nextDate.add(1, 'day');
          daysChecked++;
        }
        if (weekdays.includes(nextDate.day())) {
          if (n > 1) nextDate = nextDate.add(n - 1, 'week');
          return nextDate.format('YYYY-MM-DD');
        }
      }
      return completion.add(n, 'week').format('YYYY-MM-DD');
    }

    case RECURRENCE_PATTERNS.MONTHLY: {
      // Day-of-week mode: snap forward to the next "nth weekday of month".
      if (recurrence.monthlyMode === 'dayOfWeek'
        && recurrence.weekOfMonth != null
        && recurrence.weekdayOfMonth != null) {
        const thisMonthHit = getNthWeekdayOfMonth(completion, recurrence.weekOfMonth, recurrence.weekdayOfMonth);
        const base = thisMonthHit.isAfter(completion, 'day')
          ? thisMonthHit
          : getNthWeekdayOfMonth(completion.add(1, 'month'), recurrence.weekOfMonth, recurrence.weekdayOfMonth);
        const final = n > 1
          ? getNthWeekdayOfMonth(base.add(n - 1, 'month'), recurrence.weekOfMonth, recurrence.weekdayOfMonth)
          : base;
        return final.format('YYYY-MM-DD');
      }
      if (dayOfMonth) {
        // Snap forward to the next matching day-of-month after completion.
        let candidate = completion;
        const candidateDay = Math.min(dayOfMonth, candidate.daysInMonth());
        const snapped = candidate.date(candidateDay);
        // If the snapped date is at or before completion, push to next month.
        const next = snapped.isAfter(completion, 'day')
          ? snapped
          : candidate.add(1, 'month').date(Math.min(dayOfMonth, candidate.add(1, 'month').daysInMonth()));
        if (n > 1) {
          const future = next.add(n - 1, 'month');
          return future.date(Math.min(dayOfMonth, future.daysInMonth())).format('YYYY-MM-DD');
        }
        return next.format('YYYY-MM-DD');
      }
      return completion.add(n, 'month').format('YYYY-MM-DD');
    }

    case RECURRENCE_PATTERNS.YEARLY:
    case 'yearly':
      return completion.add(n, 'year').format('YYYY-MM-DD');

    default:
      return null;
  }
};

// Resolve which anchor to use for a recurring mission. Centralizes the Smart
// mode logic: when the recurrence shape names a calendar day (weekday picker
// for weekly, or dayOfMonth for monthly, or yearly), it's calendar-anchored;
// otherwise it's cadence (completion-anchored). The explicit override modes
// short-circuit this.
export const resolveAnchorForRecurrence = (recurrence, anchorMode = 'smart') => {
  if (anchorMode === 'dueDate' || anchorMode === 'completion') return anchorMode;
  if (!recurrence || !recurrence.pattern) return 'dueDate';

  switch (recurrence.pattern) {
    case RECURRENCE_PATTERNS.DAILY:
      return 'completion';
    case RECURRENCE_PATTERNS.WEEKLY:
      return recurrence.weekdays && recurrence.weekdays.length > 0 && recurrence.weekdays.length < 7
        ? 'dueDate'
        : 'completion';
    case RECURRENCE_PATTERNS.MONTHLY:
      if (recurrence.monthlyMode === 'dayOfWeek'
        && recurrence.weekOfMonth != null
        && recurrence.weekdayOfMonth != null) return 'dueDate';
      return recurrence.dayOfMonth ? 'dueDate' : 'completion';
    case RECURRENCE_PATTERNS.YEARLY:
      return 'dueDate';
    default:
      return 'dueDate';
  }
};

// Check if recurrence should continue based on end conditions.
// `precomputedNextDate` lets callers using completion-anchored recurrence pass
// the actual next due date (which differs from the due-date-anchored default).
export const shouldCreateNextOccurrence = (recurrence, currentOccurrenceCount = 0, currentDueDate, precomputedNextDate = null) => {
  if (!recurrence || recurrence.pattern === RECURRENCE_PATTERNS.NONE) {
    return false;
  }

  // Check if we've passed the end date
  if (recurrence.endDate) {
    const endDate = dayjs(recurrence.endDate);
    const today = dayjs();

    // If today is after the end date, stop creating new instances
    if (today.isAfter(endDate, 'day')) {
      return false;
    }

    // Also check if the next calculated due date would be after the end date
    const nextDueDate = precomputedNextDate
      ? dayjs(precomputedNextDate)
      : dayjs(calculateNextDueDate(currentDueDate, recurrence));
    if (nextDueDate.isAfter(endDate, 'day')) {
      return false;
    }
  }

  // Check max occurrences
  if (recurrence.maxOccurrences) {
    if (currentOccurrenceCount >= recurrence.maxOccurrences) {
      return false;
    }
  }

  return true;
};

// Compute the expiry date for a new occurrence. Preserves the *duration* the
// user originally set on the parent (e.g. 30 days, 1 year, etc.) by measuring
// the offset between the parent's createdAt and its expiryDate, then applying
// that same offset from "now". If the parent had no expiry, the new instance
// has none either.
const computeNextExpiryDate = (originalMission) => {
  const { expiryDate, createdAt } = originalMission;

  if (!expiryDate || expiryDate === '') return null;

  if (createdAt) {
    const parentCreated = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const parentCreatedDay = dayjs(parentCreated).startOf('day');
    const parentExpiry = dayjs(expiryDate, 'YYYY-MM-DD');
    const offsetDays = parentExpiry.diff(parentCreatedDay, 'day');

    if (offsetDays > 0) {
      return dayjs().add(offsetDays, 'day').format('YYYY-MM-DD');
    }
  }

  // Defensive fallback: parent had an expiry but we can't compute an offset
  // (missing createdAt, malformed date, or non-positive offset). Use the same
  // 30-day default the create form uses.
  return dayjs().add(30, 'day').format('YYYY-MM-DD');
};

const stabilizeRecurrenceForChild = (originalMission) => {
  const rec = originalMission.recurrence;
  if (!rec) return rec;
  if (rec.pattern === RECURRENCE_PATTERNS.MONTHLY && !rec.dayOfMonth && originalMission.dueDate) {
    return { ...rec, dayOfMonth: dayjs(originalMission.dueDate).date() };
  }
  return rec;
};

// Create next mission instance data
export const createNextMissionInstance = (originalMission, nextDueDate) => {
  // Remove fields that shouldn't be copied to the new instance
  const {
    id,
    status,
    completedAt,
    uncompletedAt,
    expiredAt,
    deletedAt,
    createdAt,
    updatedAt,
    currentCount, // Reset progress for count-based missions
    actualTimeSpentMinutes, // Reset timer progress
    xpReward, // Legacy field, no longer stored
    spReward, // Legacy field, no longer stored
    xpAwarded, // Reset — this instance hasn't been completed yet
    spAwarded, // Reset — this instance hasn't been completed yet
    isDailyMission, // Computed from daily config; don't inherit a stale value
    expiryDate, // Recomputed below to preserve the user's chosen duration
    scheduledDates, // Per-mission daily planning slots — don't carry to new doc
    customSortOrder, // Drag-and-drop position — doesn't apply to new instance
    questId, // Quests are finite — recurrence shouldn't auto-extend membership
    ...missionData
  } = originalMission;

  return {
    ...missionData,
    dueDate: nextDueDate,
    status: 'active',
    currentCount: 0, // Reset count progress
    actualTimeSpentMinutes: null, // Reset timer progress
    expiryDate: computeNextExpiryDate(originalMission),
    scheduledDates: [],
    customSortOrder: null,
    questId: null,
    // Keep the original recurrence settings, with one backfill: legacy monthly
    // missions can have a null dayOfMonth (the selector now auto-fills it, but
    // older docs don't). Backfill it from the parent's dueDate so subsequent
    // occurrences have a stable target day rather than silently drifting.
    recurrence: stabilizeRecurrenceForChild(originalMission),
    // Track relationship to original
    parentMissionId: originalMission.parentMissionId || originalMission.id,
    occurrenceNumber: (originalMission.occurrenceNumber || 1) + 1
  };
};

