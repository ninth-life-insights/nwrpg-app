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

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Format a recurrence object into a human-readable string. Used by both the
// mission card badge and the recurrence selector preview — one source of truth.
export const formatRecurrence = (recurrence) => {
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
      const dayList = sortedDays.map(d => WEEKDAY_NAMES_SHORT[d]).join(', ');

      if (sortedDays.length === 7) {
        return n === 1 ? 'Every day' : `Every ${n} weeks`;
      }
      if (sortedDays.length === 0) {
        return n === 1 ? 'Every week' : `Every ${n} weeks`;
      }
      if (n === 1 && sortedDays.length === 1) {
        return `Every ${WEEKDAY_NAMES_FULL[sortedDays[0]]}`;
      }
      if (n === 1) {
        return `Every ${dayList}`;
      }
      return `Every ${n} weeks on ${dayList}`;
    }

    case 'monthly': {
      const base = n === 1 ? 'Every month' : `Every ${n} months`;
      return dayOfMonth ? `${base} on the ${ordinal(dayOfMonth)}` : base;
    }

    case 'yearly':
      return n === 1 ? 'Every year' : `Every ${n} years`;

    default:
      return 'Recurring';
  }
};

// Mission-shaped wrapper for `formatRecurrence`. Kept for the mission card
// badge, which receives a mission object.
export const getRecurrenceDisplayText = (mission) => {
  if (!isRecurringMission(mission)) return null;
  return formatRecurrence(mission.recurrence) || 'Recurring';
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
      // dayOfMonth carries the user's intended day. If it's missing (legacy
      // missions created before the selector auto-filled it), fall back to the
      // current due date's day. Always cap to the target month's length, so
      // the 31st collapses to 28/30 in short months but jumps back to 31
      // whenever a 31-day month appears — without permanently locking in the
      // capped value.
      const nextMonth = current.add(interval, 'month');
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

// Check if recurrence should continue based on end conditions
export const shouldCreateNextOccurrence = (recurrence, currentOccurrenceCount = 0, currentDueDate) => {
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
    const nextDueDate = dayjs(calculateNextDueDate(currentDueDate, recurrence));
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

