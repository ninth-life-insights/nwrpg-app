// src/contexts/RoutineContext.jsx
import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { useAuth } from './AuthContext';
import { getRoutines, resumeRoutine, isRoutinePaused } from '../services/routineService';
import { getRoutineMissionRootSet } from '../utils/routineHelpers';

const RoutineContext = createContext(null);

export const useRoutines = () => {
  const ctx = useContext(RoutineContext);
  if (!ctx) throw new Error('useRoutines must be used within a RoutineProvider');
  return ctx;
};

// Mirrors RoomsContext / QuestsContext: one-shot fetch on login + manual
// refresh after mutations. No onSnapshot — listener thrash isn't a concern at
// this scale, and the codebase already standardizes on fetch+refresh.
//
// The default routine is NOT auto-created here. Callers that need to ensure
// it exists (RoutinesPage on mount, AddMissionCard's "Add to routine" toggle)
// call getOrCreateDefaultRoutine explicitly. This keeps the feature truly
// opt-in — users who never engage with routines don't leave an empty doc
// behind.
export const RoutineProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [routines, setRoutines] = useState([]);
  // Guards against re-triggering an in-flight auto-resume. The routines
  // state changes when resume completes (post-refetch), which would
  // otherwise re-fire the effect during the brief in-flight window.
  const autoResumeInFlight = useRef(false);

  const fetchRoutines = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await getRoutines(currentUser.uid);
      setRoutines(data);
    } catch (err) {
      console.error('fetchRoutines failed:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setRoutines([]);
      return;
    }
    fetchRoutines();
  }, [currentUser, fetchRoutines]);

  // Auto-resume any routine whose pausedUntil has passed. Detected on each
  // routine fetch — when the user opens the app after a pause expires, the
  // resume runs silently, due dates recalc, and views show the active state
  // as if it were never paused. Idempotent: a no-pause routine won't trigger
  // resume work.
  useEffect(() => {
    if (!currentUser || routines.length === 0) return;
    if (autoResumeInFlight.current) return;

    const todayStr = dayjs().format('YYYY-MM-DD');
    const expired = routines.filter(
      (r) => r.pausedSince && r.pausedUntil && r.pausedUntil < todayStr
    );
    if (expired.length === 0) return;

    autoResumeInFlight.current = true;
    (async () => {
      for (const r of expired) {
        try {
          await resumeRoutine(currentUser.uid, r.id);
        } catch (err) {
          console.error('Auto-resume failed for routine', r.id, err);
        }
      }
      await fetchRoutines();
      autoResumeInFlight.current = false;
    })();
  }, [routines, currentUser, fetchRoutines]);

  const routineRootSet = useMemo(() => getRoutineMissionRootSet(routines), [routines]);

  // Chain-root-id → position. Built from each routine's missionChainIds in
  // order (first appearance wins for chain roots that live in multiple
  // routines). Used by both builder and today-view to sort missions per the
  // user's drag-to-reorder choices. The routine doc owns the order; the
  // missions themselves carry no per-instance customSortOrder for routines.
  const routineOrderMap = useMemo(() => {
    const map = new Map();
    for (const routine of routines) {
      if (!Array.isArray(routine.missionChainIds)) continue;
      for (const chainRootId of routine.missionChainIds) {
        if (!chainRootId) continue;
        if (!map.has(chainRootId)) map.set(chainRootId, map.size);
      }
    }
    return map;
  }, [routines]);

  // Chain roots whose routine is currently paused. Routine surfaces (today
  // view, home next-up card, future projections) filter these out so the
  // user doesn't see items from a routine she's intentionally muted.
  const pausedRootSet = useMemo(() => {
    const set = new Set();
    for (const r of routines) {
      if (!isRoutinePaused(r)) continue;
      if (!Array.isArray(r.missionChainIds)) continue;
      for (const id of r.missionChainIds) {
        if (id) set.add(id);
      }
    }
    return set;
  }, [routines]);

  // Per-membership cadence merged across all routines (first non-empty entry
  // wins for chain roots that live in multiple routines — same precedence
  // model as routineOrderMap). Consumers (routine builder, today view, home
  // next-up card) read this to decide bucket and rolling-window owed status.
  // Sparse: an absent entry means "default daily" (current pre-feature behavior).
  const cadenceByChainRoot = useMemo(() => {
    const merged = {};
    for (const r of routines) {
      const map = r?.cadenceByChainRoot;
      if (!map || typeof map !== 'object') continue;
      for (const [rootId, cadence] of Object.entries(map)) {
        if (rootId && cadence && !merged[rootId]) merged[rootId] = cadence;
      }
    }
    return merged;
  }, [routines]);

  return (
    <RoutineContext.Provider
      value={{
        routines,
        routineRootSet,
        routineOrderMap,
        pausedRootSet,
        cadenceByChainRoot,
        refreshRoutines: fetchRoutines,
      }}
    >
      {children}
    </RoutineContext.Provider>
  );
};
