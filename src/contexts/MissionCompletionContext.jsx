import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { useMissions } from './MissionsContext';
import {
  completeMissionWithRecurrence,
  uncompleteMission as uncompleteMissionService,
} from '../services/missionService';
import { MISSION_STATUS } from '../types/Mission';

// Wraps the mission-completion service so every surface gets the same
// optimistic-UI behavior:
//   - tap → checkbox flips instantly (in either direction)
//   - second tap during the in-flight write is dropped (double-tap guard,
//     and it covers both directions — no completing-during-uncomplete races)
//   - optimistic state survives reload via sessionStorage. Without this, a
//     tap → close-app → reopen-while-offline-replay-is-pending shows the
//     pre-tap state for a beat before the queued Firestore write resolves
//     and the card "magically" flips. Reads as buggy.
//   - server resolves → level-up / achievement modals fire
//   - server rejects → optimistic state rolls back, transient error chip shows
const MissionCompletionContext = createContext(null);

export const useMissionCompletion = () => {
  const ctx = useContext(MissionCompletionContext);
  if (!ctx) {
    throw new Error('useMissionCompletion must be used within MissionCompletionProvider');
  }
  return ctx;
};

const ERROR_CHIP_MS = 4000;
const OPTIMISTIC_STORAGE_KEY_PREFIX = 'nwrpg.optimistic-mission-status:';
const getOptimisticStorageKey = (uid) => `${OPTIMISTIC_STORAGE_KEY_PREFIX}${uid}`;

export const MissionCompletionProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { notifyMissionCompletion } = useNotifications();
  const {
    missions,
    mutate: mutateMissions,
    refresh: refreshMissions,
  } = useMissions();

  // Ref for the double-tap guard — must be synchronous so a rapid second tap
  // sees the set before React commits a state update.
  const pendingIdsRef = useRef(new Set());

  // Mirror in state so consuming components re-render when pending changes.
  const [pendingIds, setPendingIds] = useState(() => new Set());
  // Map<missionId, 'completed' | 'active'>. The user's last commit-intent
  // that the cache may not yet reflect. Persisted to sessionStorage so it
  // survives reload (see header comment). Cleared per-id by the
  // reconciliation effect once the cache catches up to match.
  const [optimisticStatusById, setOptimisticStatusById] = useState(() => new Map());
  const [failedIds, setFailedIds] = useState(() => new Set());

  const errorClearTimersRef = useRef(new Map());

  // Cancel any pending error-chip auto-clear timers when the provider
  // unmounts (logout, route change that drops the tree, hot-reload). Without
  // this, a timer that fires after unmount calls setState on a dead
  // component → React warning. Stable: errorClearTimersRef is a ref.
  useEffect(() => {
    const timers = errorClearTimersRef.current;
    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    };
  }, []);

  // Hydrate optimistic state from sessionStorage on user load. Namespaced
  // by uid so a sign-out → sign-in-as-someone-else doesn't inherit the
  // previous user's pending intent.
  useEffect(() => {
    if (!currentUser?.uid) {
      setOptimisticStatusById(new Map());
      return;
    }
    try {
      const raw = sessionStorage.getItem(getOptimisticStorageKey(currentUser.uid));
      if (raw) {
        const entries = JSON.parse(raw);
        if (Array.isArray(entries)) {
          setOptimisticStatusById(new Map(entries));
        }
      }
    } catch (err) {
      console.warn('Failed to hydrate optimistic mission state:', err);
    }
  }, [currentUser]);

  // Persist optimistic state on every change. Tiny payload (handful of
  // ids); a write per change is fine.
  useEffect(() => {
    if (!currentUser?.uid) return;
    try {
      sessionStorage.setItem(
        getOptimisticStorageKey(currentUser.uid),
        JSON.stringify([...optimisticStatusById.entries()])
      );
    } catch (err) {
      console.warn('Failed to persist optimistic mission state:', err);
    }
  }, [optimisticStatusById, currentUser]);

  // Reconciliation: drop optimistic entries once the shared cache reports
  // the same status. Without this, the Map grows unboundedly across a
  // session — every completion stamps an entry that never gets cleared.
  useEffect(() => {
    if (!missions || optimisticStatusById.size === 0) return;
    setOptimisticStatusById((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, expectedStatus] of prev) {
        const cached = missions.find((m) => m.id === id);
        if (cached && cached.status === expectedStatus) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [missions, optimisticStatusById]);

  const addToSet = (setter, id) => setter((prev) => {
    if (prev.has(id)) return prev;
    const next = new Set(prev);
    next.add(id);
    return next;
  });

  const removeFromSet = (setter, id) => setter((prev) => {
    if (!prev.has(id)) return prev;
    const next = new Set(prev);
    next.delete(id);
    return next;
  });

  const setOptimisticStatus = (id, status) => setOptimisticStatusById((prev) => {
    if (prev.get(id) === status) return prev;
    const next = new Map(prev);
    next.set(id, status);
    return next;
  });

  // Returns a promise that resolves to the server result (or null if dropped
  // by the double-tap guard / no user). Surfaces that want the legacy "await
  // and inspect the result" pattern can do so; surfaces that just want
  // fire-and-forget can ignore the return.
  const completeMission = useCallback(async (missionId, mission, options = {}) => {
    const { onLocalMutation, onError, onResolved, onAchievementsResolved } = options;

    if (!currentUser?.uid || !missionId) return null;
    if (pendingIdsRef.current.has(missionId)) return null;

    pendingIdsRef.current.add(missionId);
    addToSet(setPendingIds, missionId);
    setOptimisticStatus(missionId, 'completed');

    // Clear any prior error chip on this mission so the new attempt isn't
    // visually shadowed by a stale failure.
    removeFromSet(setFailedIds, missionId);
    const existingTimer = errorClearTimersRef.current.get(missionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      errorClearTimersRef.current.delete(missionId);
    }

    // Patch the shared missions cache too, so any page reading from
    // MissionsContext sees the optimistic completion immediately — no
    // dependency on the surface-level onLocalMutation callback.
    mutateMissions((prev) => prev.map((m) => (
      m.id === missionId
        ? { ...m, status: MISSION_STATUS.COMPLETED, completedAt: new Date() }
        : m
    )));

    onLocalMutation?.({ type: 'completed', missionId, mission });

    try {
      const result = await completeMissionWithRecurrence(currentUser.uid, missionId);
      notifyMissionCompletion(result);

      // Stamp the server-returned XP/SP values on the cached mission. If a
      // recurring/evergreen completion spawned a new instance, kick off a
      // background refresh to pick it up — the original mission's check has
      // already flipped optimistically.
      mutateMissions((prev) => prev.map((m) => (
        m.id === missionId
          ? {
              ...m,
              xpAwarded: result?.xpAwarded ?? m.xpAwarded ?? null,
              spAwarded: result?.spAwarded ?? m.spAwarded ?? null,
            }
          : m
      )));
      if (result?.nextMissionCreated) {
        refreshMissions();
      }

      onLocalMutation?.({ type: 'serverResolved', missionId, result });
      onResolved?.(result);
      if (result?.newlyAwardedAchievements?.length > 0) {
        onAchievementsResolved?.(result.newlyAwardedAchievements);
      }
      return result;
    } catch (err) {
      console.error('Optimistic mission completion failed:', err);
      setOptimisticStatus(missionId, 'active');
      addToSet(setFailedIds, missionId);
      const timer = setTimeout(() => {
        removeFromSet(setFailedIds, missionId);
        errorClearTimersRef.current.delete(missionId);
      }, ERROR_CHIP_MS);
      errorClearTimersRef.current.set(missionId, timer);

      // Roll the cache back to active so any page reading from it reverts too.
      mutateMissions((prev) => prev.map((m) => (
        m.id === missionId ? { ...m, status: MISSION_STATUS.ACTIVE, completedAt: null } : m
      )));

      onLocalMutation?.({ type: 'rollback', missionId });
      onError?.(missionId, err);
      return null;
    } finally {
      pendingIdsRef.current.delete(missionId);
      removeFromSet(setPendingIds, missionId);
    }
  }, [currentUser, notifyMissionCompletion, mutateMissions, refreshMissions]);

  // Mirror of completeMission for the other direction. Same pending guard
  // (the ref Set is per-mission, not per-direction — so a tap-uncomplete
  // during an in-flight complete is dropped, and vice versa). Synchronously
  // clears the optimistic-complete flag AND patches the cache to ACTIVE, so
  // the checkmark flips OFF instantly. On error, both the flag and the cache
  // snapshot are restored so the card snaps back to "complete" — matching
  // the actual server state.
  const uncompleteMission = useCallback(async (missionId, options = {}) => {
    const { onLocalMutation, onError, onResolved } = options;

    if (!currentUser?.uid || !missionId) return null;
    if (pendingIdsRef.current.has(missionId)) return null;

    pendingIdsRef.current.add(missionId);
    addToSet(setPendingIds, missionId);
    setOptimisticStatus(missionId, 'active');

    // Clear any prior error chip on this mission so the new attempt isn't
    // visually shadowed by a stale failure.
    removeFromSet(setFailedIds, missionId);
    const existingTimer = errorClearTimersRef.current.get(missionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      errorClearTimersRef.current.delete(missionId);
    }

    // Snapshot the mission BEFORE mutating so rollback can restore its
    // completedAt / xpAwarded / spAwarded exactly.
    let preSnapshot = null;
    mutateMissions((prev) => prev.map((m) => {
      if (m.id !== missionId) return m;
      preSnapshot = m;
      return {
        ...m,
        status: MISSION_STATUS.ACTIVE,
        completedAt: null,
        xpAwarded: null,
        spAwarded: null,
      };
    }));

    onLocalMutation?.({ type: 'uncompleted', missionId });

    try {
      const result = await uncompleteMissionService(currentUser.uid, missionId);
      onLocalMutation?.({ type: 'serverResolved', missionId, result });
      onResolved?.(result);
      return result;
    } catch (err) {
      console.error('Optimistic mission uncomplete failed:', err);
      setOptimisticStatus(missionId, 'completed');
      addToSet(setFailedIds, missionId);
      const timer = setTimeout(() => {
        removeFromSet(setFailedIds, missionId);
        errorClearTimersRef.current.delete(missionId);
      }, ERROR_CHIP_MS);
      errorClearTimersRef.current.set(missionId, timer);

      if (preSnapshot) {
        mutateMissions((prev) => prev.map((m) => (
          m.id === missionId ? preSnapshot : m
        )));
      }

      onLocalMutation?.({ type: 'rollback', missionId });
      onError?.(missionId, err);
      return null;
    } finally {
      pendingIdsRef.current.delete(missionId);
      removeFromSet(setPendingIds, missionId);
    }
  }, [currentUser, mutateMissions]);

  const isPending = useCallback((id) => pendingIds.has(id), [pendingIds]);
  // Returns 'completed' | 'active' | null. Cards prefer this over the
  // cache-derived status when it's non-null — it represents the user's
  // most recent commit-intent for this session, which may not yet be
  // reflected in the shared cache.
  const getOptimisticStatus = useCallback(
    (id) => optimisticStatusById.get(id) ?? null,
    [optimisticStatusById]
  );
  const hasError = useCallback((id) => failedIds.has(id), [failedIds]);

  return (
    <MissionCompletionContext.Provider value={{
      completeMission,
      uncompleteMission,
      isPending,
      getOptimisticStatus,
      hasError,
    }}>
      {children}
    </MissionCompletionContext.Provider>
  );
};
