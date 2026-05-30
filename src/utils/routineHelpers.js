// src/utils/routineHelpers.js
import dayjs from 'dayjs';
import { MISSION_STATUS } from '../types/Mission';
import {
  isRecurringMission,
  RECURRENCE_PATTERNS,
  calculateNextDueDate,
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

// Group recurring missions by recurrence pattern for the Builder's bird's-eye
// view. Non-recurring missions are filtered out defensively — if a user changes
// a routine-member's dueType away from RECURRING, it should drop out of the
// grouping rather than crash or land in an unexpected bucket.
export const groupRoutineMissionsByFrequency = (missions) => {
  const buckets = { daily: [], weekly: [], monthly: [], yearly: [] };
  if (!Array.isArray(missions)) return buckets;

  for (const mission of missions) {
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
export const getRoutineMissionsForDate = (missions, rootSet, viewDateInput) => {
  if (!Array.isArray(missions) || !rootSet) return [];

  const today = dayjs().startOf('day');
  const viewDate = viewDateInput
    ? dayjs(viewDateInput).startOf('day')
    : today;
  const isToday = viewDate.isSame(today, 'day');

  if (isToday) {
    return missions
      .filter((m) => {
        if (!m) return false;
        if (!isRecurringMission(m)) return false;
        if (!isMissionInRoutineSet(m, rootSet)) return false;

        if (m.status === MISSION_STATUS.ACTIVE) {
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
      .sort((a, b) => {
        // Active items above completed within the same view; among active,
        // earlier dueDate first (overdue surfaces first).
        const aActive = a.status === MISSION_STATUS.ACTIVE;
        const bActive = b.status === MISSION_STATUS.ACTIVE;
        if (aActive !== bActive) return aActive ? -1 : 1;
        if (aActive) {
          const ad = dayjs(a.dueDate);
          const bd = dayjs(b.dueDate);
          if (ad.isSame(bd, 'day')) return 0;
          return ad.isBefore(bd, 'day') ? -1 : 1;
        }
        return 0;
      });
  }

  // Future view — project each active instance forward.
  return missions.filter((m) => {
    if (!m || m.status !== MISSION_STATUS.ACTIVE) return false;
    if (!isRecurringMission(m)) return false;
    if (!isMissionInRoutineSet(m, rootSet)) return false;
    if (!m.dueDate || m.dueDate === '') return false;

    let current = dayjs(m.dueDate).startOf('day');
    if (current.isSame(viewDate, 'day')) return true;
    if (current.isAfter(viewDate, 'day')) return false;

    // Iterate forward through the recurrence pattern. Each iteration computes
    // the next due date from `current` — same math the spawn-on-complete flow
    // uses, so projection matches reality.
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
  });
};

// Backward-compatible alias. Callers that just want "today" can keep using
// this; the date-aware version is preferred for new code.
export const getTodaysRoutineMissions = (missions, rootSet) =>
  getRoutineMissionsForDate(missions, rootSet, dayjs());
