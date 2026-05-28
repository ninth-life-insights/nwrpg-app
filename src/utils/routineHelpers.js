// src/utils/routineHelpers.js
import dayjs from 'dayjs';
import { MISSION_STATUS } from '../types/Mission';
import { isRecurringMission, RECURRENCE_PATTERNS } from './recurrenceHelpers';

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

// Return today's (and overdue) active routine mission instances, sorted by
// dueDate ascending.
//
// Filters: in the routine set, dueType === 'recurring' (defensive), status
// active, dueDate present and <= today.
//
// Why "<= today" instead of "=== today": missions can become overdue across
// midnight rollovers, and a routine surface that hid overdue items would be
// dishonest to the user. Ascending sort means overdue items appear first.
//
// Undo-window note: completeMissionWithRecurrence spawns a child instance
// immediately. Within the 60s undo window the parent may be restored to ACTIVE
// while the spawned child still exists (it gets cleaned up async by
// cleanupRecentlySpawnedChild). The child's dueDate is in the future, so this
// filter naturally excludes it — the restored parent (today) wins. Don't
// "fix" this by tightening the filter; the future-date filter IS the fix.
export const getTodaysRoutineMissions = (missions, rootSet) => {
  if (!Array.isArray(missions) || !rootSet) return [];

  const today = dayjs();

  return missions
    .filter((m) => {
      if (!m || m.status !== MISSION_STATUS.ACTIVE) return false;
      if (!isRecurringMission(m)) return false;
      if (!isMissionInRoutineSet(m, rootSet)) return false;
      if (!m.dueDate || m.dueDate === '') return false;
      const due = dayjs(m.dueDate);
      return !due.isAfter(today, 'day');
    })
    .sort((a, b) => {
      const ad = dayjs(a.dueDate);
      const bd = dayjs(b.dueDate);
      if (ad.isSame(bd, 'day')) return 0;
      return ad.isBefore(bd, 'day') ? -1 : 1;
    });
};
