import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { getAllMissions } from '../services/missionService';

// Stale-while-revalidate cache for the user's full mission list.
// Pages that read from here render their cached content immediately on
// revisit (no blank → skeleton → content flash) while a background fetch
// keeps the cache fresh.
//
//   missions          : null until the first ever load, then Mission[].
//   isInitialLoading  : true only on the first load (no cache yet).
//   isRefreshing      : true during any in-flight background fetch.
//   refresh()         : trigger a fetch now. Safe to call repeatedly —
//                       overlapping calls collapse to one in-flight fetch.
//   mutate(updater)   : optimistically patch the cache locally. Call from
//                       MissionCompletionContext / create / edit / delete
//                       handlers so the UI updates without a round-trip.
const MissionsContext = createContext(null);

export const useMissions = () => {
  const ctx = useContext(MissionsContext);
  if (!ctx) {
    throw new Error('useMissions must be used within MissionsProvider');
  }
  return ctx;
};

const FOCUS_REFRESH_MIN_AGE_MS = 30_000;

export const MissionsProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [missions, setMissions] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // lastFetchAt drives the focus-refresh debounce. Kept in a ref so the
  // focus listener doesn't need to re-bind whenever it changes.
  const lastFetchAtRef = useRef(0);
  // Collapses overlapping refresh() calls into a single in-flight fetch.
  const inFlightRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!currentUser?.uid) return;
    if (inFlightRef.current) return inFlightRef.current;

    setIsRefreshing(true);
    const promise = (async () => {
      try {
        const data = await getAllMissions(currentUser.uid);
        setMissions(data);
        lastFetchAtRef.current = Date.now();
      } catch (err) {
        console.error('MissionsContext: refresh failed', err);
      } finally {
        setIsRefreshing(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = promise;
    return promise;
  }, [currentUser]);

  // First load — and reload whenever the signed-in user changes.
  useEffect(() => {
    if (!currentUser?.uid) {
      setMissions(null);
      lastFetchAtRef.current = 0;
      return;
    }
    refresh();
  }, [currentUser, refresh]);

  // Window-focus refresh — handles "I left the tab open for an hour" and
  // multi-tab edits. Debounced so a quick alt-tab doesn't spam Firestore.
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastFetchAtRef.current < FOCUS_REFRESH_MIN_AGE_MS) return;
      refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const mutate = useCallback((updater) => {
    setMissions((prev) => {
      if (prev == null) return prev;
      return updater(prev);
    });
  }, []);

  return (
    <MissionsContext.Provider value={{
      missions,
      isInitialLoading: missions === null,
      isRefreshing,
      refresh,
      mutate,
    }}>
      {children}
    </MissionsContext.Provider>
  );
};
