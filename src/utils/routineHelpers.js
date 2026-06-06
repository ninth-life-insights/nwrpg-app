// src/utils/routineHelpers.js
import dayjs from 'dayjs';
import { MISSION_STATUS } from '../types/Mission';
import {
  isRecurringMission,
  isEvergreenMission,
  RECURRENCE_PATTERNS,
  calculateNextDueDate,
  getNthWeekdayOfMonth,
} from './recurrenceHelpers';

// Resolve the "chain root" mission ID for a mission. Recurring missions form a
// chain via parentMissionId: the original template is the root, and each
// subsequent occurrence points back to it. Routine membership is recorded
// against the root, so child instances inherit it for free.
export const getMissionChainRoot = (mission) => {
  if (!mission) return null;
  return mission.parentMissionId || mission.id;
};

// Build the Set of all chain roots that belong to any active routine.
// Callers (RoutineContext) should memoize this against the routines array.
export const getRoutineMissionRootSet = (routines) => {
  const set = new Set();
  if (!Array.isArray(routines)) return set;
  for (const routine of routines) {
    if (!routine || !Array.isArray(routine.missionChainIds)) continue;
    for (const rootId of routine.missionChainIds) {
      if (rootId) set.add(rootId);
    }
  }
  return set;
};

// Membership check. Cheap once the rootSet is precomputed.
export const isMissionInRoutineSet = (mission, rootSet) => {
  if (!mission || !rootSet) return false;
  const root = getMissionChainRoot(mission);
  return root != null && rootSet.has(root);
};

// Group routine missions by frequency bucket for the Builder's bird's-eye
// view. Recurring missions bucket by their recurrence pattern. Evergreen
// missions default to the Daily bucket — they have no schedule but "always
// available" reads as a daily standing task in the routine model. (User-
// facing affordance to promote evergreens into other buckets is a v2 idea.)
// Non-recurring + non-evergreen missions are filtered out defensively.
export const groupRoutineMissionsByFrequency = (missions) => {
  const buckets = { daily: [], weekly: [], monthly: [], yearly: [] };
  if (!Array.isArray(missions)) return buckets;

  for (const mission of missions) {
    if (isEvergreenMission(mission)) {
      buckets.daily.push(mission);
      continue;
    }
    if (!isRecurringMission(mission)) continue;
    const pattern = mission.recurrence?.pattern;
    switch (pattern) {
      case RECURRENCE_PATTERNS.DAILY:
        buckets.daily.push(mission);
        break;
      case RECURRENCE_PATTERNS.WEEKLY:
        buckets.weekly.push(mission);
        break;
      case RECURRENCE_PATTERNS.MONTHLY:
        buckets.monthly.push(mission);
        break;
      case RECURRENCE_PATTERNS.YEARLY:
        buckets.yearly.push(mission);
        break;
      default:
        // Unknown / 'custom' / 'none' patterns: skip silently. Custom can be
        // surfaced in v2 once the UX for it is decided.
        break;
    }
  }

  return buckets;
};

// Fallback sort key when no routine order map is provided — uses each
// mission's own createdAt (when the doc was made or spawned). Imperfect for
// long-running chains where the visible instance was spawned much later than
// the original; the routine order map (built from routine.missionChainIds)
// is the authoritative source and overrides this when supplied.
const createdAtMs = (m) => {
  const ca = m?.createdAt;
  if (!ca) return 0;
  if (ca.toDate) return ca.toDate().getTime();
  return new Date(ca).getTime();
};

// Build a sort comparator that prefers routine-doc order (mapped by chain
// root) and falls back to createdAt for items missing from the map.
export const makeRoutineSortComparator = (orderMap) => (a, b) => {
  if (orderMap) {
    const aRoot = getMissionChainRoot(a);
    const bRoot = getMissionChainRoot(b);
    const aOrder = orderMap.get(aRoot);
    const bOrder = orderMap.get(bRoot);
    const aHas = typeof aOrder === 'number';
    const bHas = typeof bOrder === 'number';
    if (aHas && bHas) return aOrder - bOrder;
    if (aHas) return -1;
    if (bHas) return 1;
  }
  return createdAtMs(a) - createdAtMs(b);
};

// Return routine missions relevant to a given view date.
//
//   viewDate === today:  active items with dueDate <= today (so overdue
//                        carries in), PLUS today's completed items (so the
//                        page reads like a to-do list with progress, not
//                        a vanishing checklist). Active sorted first by
//                        dueDate asc; completed below.
//
//   viewDate > today:    routine missions projected to have an occurrence
//                        on viewDate. We iterate calculateNextDueDate forward
//                        from each active instance's current dueDate until
//                        either an occurrence lands on viewDate (include) or
//                        the iteration overshoots (skip). Completed items
//                        are NOT shown for future views — they belong to
//                        their actual day.
//
// Defensive type filter: missions that are no longer `recurring` (e.g. user
// flipped dueType post-membership) are silently dropped via isRecurringMission.
export const getRoutineMissionsForDate = (
  missions,
  rootSet,
  viewDateInput,
  orderMap = null,
  pausedRootSet = null
) => {
  if (!Array.isArray(missions) || !rootSet) return [];

  const today = dayjs().startOf('day');
  const viewDate = viewDateInput
    ? dayjs(viewDateInput).startOf('day')
    : today;
  const isToday = viewDate.isSame(today, 'day');

  // Paused chain roots are excluded from all routine view filters. Today
  // view, future projection, home next-up card — all hide a paused
  // routine's items until pause ends and auto-resume re-schedules them.
  const isPausedMember = (m) => {
    if (!pausedRootSet || pausedRootSet.size === 0) return false;
    const root = getMissionChainRoot(m);
    return root != null && pausedRootSet.has(root);
  };

  if (isToday) {
    return missions
      .filter((m) => {
        if (!m) return false;
        const isEvergreen = isEvergreenMission(m);
        if (!isRecurringMission(m) && !isEvergreen) return false;
        if (!isMissionInRoutineSet(m, rootSet)) return false;
        if (isPausedMember(m)) return false;

        if (m.status === MISSION_STATUS.ACTIVE) {
          // Evergreens have no schedule — they're always "today" for
          // routine purposes.
          if (isEvergreen) return true;
          if (!m.dueDate || m.dueDate === '') return false;
          return !dayjs(m.dueDate).isAfter(viewDate, 'day');
        }
        if (m.status === MISSION_STATUS.COMPLETED) {
          if (!m.completedAt) return false;
          const cAt = m.completedAt.toDate
            ? m.completedAt.toDate()
            : new Date(m.completedAt);
          return dayjs(cAt).isSame(viewDate, 'day');
        }
        return false;
      })
      .sort(makeRoutineSortComparator(orderMap));
  }

  // Future view — project each active instance forward.
  return missions
    .filter((m) => {
      if (!m || m.status !== MISSION_STATUS.ACTIVE) return false;
      if (!isRecurringMission(m)) return false;
      if (!isMissionInRoutineSet(m, rootSet)) return false;
      if (isPausedMember(m)) return false;
      if (!m.dueDate || m.dueDate === '') return false;

      let current = dayjs(m.dueDate).startOf('day');
      if (current.isSame(viewDate, 'day')) return true;
      if (current.isAfter(viewDate, 'day')) return false;

      // Iterate forward through the recurrence pattern. Each iteration
      // computes the next due date from `current` — same math the spawn-on-
      // complete flow uses, so projection matches reality.
      let safety = 0;
      while (current.isBefore(viewDate, 'day') && safety++ < 500) {
        const next = calculateNextDueDate(
          current.format('YYYY-MM-DD'),
          m.recurrence
        );
        if (!next) return false;
        const nextDate = dayjs(next).startOf('day');
        if (nextDate.isAfter(viewDate, 'day')) return false;
        current = nextDate;
      }
      return current.isSame(viewDate, 'day');
    })
    .sort(makeRoutineSortComparator(orderMap));
};

// Backward-compatible alias. Callers that just want "today" can keep using
// this; the date-aware version is preferred for new code.
export const getTodaysRoutineMissions = (missions, rootSet) =>
  getRoutineMissionsForDate(missions, rootSet, dayjs());

// Given a starting date and a recurrence config, find the first valid
// occurrence on or after that date. Used by routine resume to "wake up"
// short-cycle tasks (daily/weekly/monthly) at the next natural occurrence
// rather than catapulting them forward by the pause duration.
//
// Yearly is NOT handled here — callers should use simple-shift for yearly so
// a 1-week pause doesn't push a yearly task an entire year out. See
// recalcDueDateForResume below.
export const findNextOccurrenceOnOrAfter = (fromDateInput, recurrence) => {
  if (!recurrence || !recurrence.pattern) return null;
  const from = dayjs(fromDateInput).startOf('day');
  const { pattern, weekdays = [], dayOfMonth, monthlyMode } = recurrence;

  switch (pattern) {
    case RECURRENCE_PATTERNS.DAILY:
    case 'daily':
      return from.format('YYYY-MM-DD');

    case RECURRENCE_PATTERNS.WEEKLY: {
      if (!Array.isArray(weekdays) || weekdays.length === 0) {
        // No specific weekdays → treat resume as the new cycle start
        return from.format('YYYY-MM-DD');
      }
      // Scan today + next 6 days for the first matching weekday
      for (let i = 0; i < 7; i++) {
        const candidate = from.add(i, 'day');
        if (weekdays.includes(candidate.day())) {
          return candidate.format('YYYY-MM-DD');
        }
      }
      // Defensive fallback (shouldn't reach)
      return from.format('YYYY-MM-DD');
    }

    case RECURRENCE_PATTERNS.MONTHLY: {
      // Day-of-week mode (e.g. "2nd Tuesday of the month"). Find the matching
      // weekday this month; if it's already passed, jump to next month.
      if (
        monthlyMode === 'dayOfWeek' &&
        recurrence.weekOfMonth != null &&
        recurrence.weekdayOfMonth != null
      ) {
        const thisMonth = getNthWeekdayOfMonth(
          from,
          recurrence.weekOfMonth,
          recurrence.weekdayOfMonth
        );
        if (!thisMonth.isBefore(from, 'day')) {
          return thisMonth.format('YYYY-MM-DD');
        }
        const nextMonth = getNthWeekdayOfMonth(
          from.add(1, 'month'),
          recurrence.weekOfMonth,
          recurrence.weekdayOfMonth
        );
        return nextMonth.format('YYYY-MM-DD');
      }
      // Day-of-month mode (default). If today.date() <= dayOfMonth and that
      // day exists in the current month, use it. Otherwise next month's
      // matching day (clamped to that month's length).
      if (!dayOfMonth) return from.format('YYYY-MM-DD');
      const thisMonthClamped = Math.min(dayOfMonth, from.daysInMonth());
      if (from.date() <= thisMonthClamped) {
        return from.date(thisMonthClamped).format('YYYY-MM-DD');
      }
      const nextMonth = from.add(1, 'month');
      const nextMonthClamped = Math.min(dayOfMonth, nextMonth.daysInMonth());
      return nextMonth.date(nextMonthClamped).format('YYYY-MM-DD');
    }

    default:
      // Yearly, custom, or unknown — caller decides. Return null so the
      // recalc function knows to fall through to the simple-shift branch
      // (or whatever the caller wants for unhandled patterns).
      return null;
  }
};

// Resume a single mission's dueDate after a routine pause. Branches on
// recurrence pattern: short-cycle (daily/weekly/monthly) walks the
// recurrence forward FROM THE MISSION'S CURRENT DUEDATE until landing on or
// after the resume date, so cycle anchors (every-N-weeks, every-N-months)
// are respected. Long-cycle (yearly) shifts forward by the pause duration
// so the task doesn't disappear for a full year.
//
//   mission         — routine member mission with an active dueDate
//   resumeDate      — the day pause ended (string or dayjs)
//   shiftDays       — number of days the pause covered (used for yearly only)
//
// Returns a YYYY-MM-DD string. If pattern is unrecognized, returns today
// as a defensive default.
//
// Why iterate from mission.dueDate (not from resumeDate): for interval > 1
// (biweekly, quarterly, etc.), the cadence is anchored to the original
// dueDate. Resuming on a matching weekday that doesn't align with the
// every-N-weeks rhythm would silently shift the cycle. Walking forward
// from dueDate via calculateNextDueDate preserves the anchor.
export const recalcDueDateForResume = (mission, resumeDate, shiftDays) => {
  if (!mission || !mission.recurrence) {
    return dayjs(resumeDate).format('YYYY-MM-DD');
  }
  const pattern = mission.recurrence.pattern;
  const resume = dayjs(resumeDate).startOf('day');

  // Yearly → simple shift by pause duration. A short pause on a yearly task
  // should delay it by ~the pause length, not push it out a whole year.
  if (pattern === RECURRENCE_PATTERNS.YEARLY || pattern === 'yearly') {
    const current = dayjs(mission.dueDate || resume).startOf('day');
    return current.add(shiftDays, 'day').format('YYYY-MM-DD');
  }

  // Daily / Weekly / Monthly → walk the recurrence forward from the
  // mission's current dueDate until landing on or after resume.
  if (!mission.dueDate || mission.dueDate === '') {
    // No anchor to walk from — fall back to resume-relative snap.
    const snapped = findNextOccurrenceOnOrAfter(resume, mission.recurrence);
    return snapped || resume.format('YYYY-MM-DD');
  }

  let current = dayjs(mission.dueDate).startOf('day');
  // If already on or after resume, no change needed (mission was scheduled
  // ahead of the pause window).
  if (!current.isBefore(resume, 'day')) {
    return current.format('YYYY-MM-DD');
  }

  let safety = 0;
  while (current.isBefore(resume, 'day') && safety++ < 1000) {
    const next = calculateNextDueDate(
      current.format('YYYY-MM-DD'),
      mission.recurrence
    );
    if (!next) break;
    const nextDate = dayjs(next).startOf('day');
    if (!nextDate.isAfter(current, 'day')) break; // defensive: avoid infinite loop on stuck pattern
    current = nextDate;
  }

  return current.format('YYYY-MM-DD');
};
