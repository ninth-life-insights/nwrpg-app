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

  return (
    <RoutineContext.Provider
      value={{ routines, routineRootSet, refreshRoutines: fetchRoutines }}
    >
      {children}
    </RoutineContext.Provider>
  );
};
