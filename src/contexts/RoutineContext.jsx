// src/contexts/RoutineContext.jsx
import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { getRoutines } from '../services/routineService';
import { getRoutineMissionRootSet } from '../utils/routineHelpers';
import { logError } from '../utils/errorBuffer';

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

  const fetchRoutines = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await getRoutines(currentUser.uid);
      setRoutines(data);
    } catch (err) {
      console.error('fetchRoutines failed:', err);
      logError('routines-fetch', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setRoutines([]);
      return;
    }
    fetchRoutines();
  }, [currentUser, fetchRoutines]);

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

  return (
    <RoutineContext.Provider
      value={{
        routines,
        routineRootSet,
        routineOrderMap,
        refreshRoutines: fetchRoutines,
      }}
    >
      {children}
    </RoutineContext.Provider>
  );
};
