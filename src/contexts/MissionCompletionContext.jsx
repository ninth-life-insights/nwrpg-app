import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { useMissions } from './MissionsContext';
import { completeMissionWithRecurrence } from '../services/missionService';
import { MISSION_STATUS } from '../types/Mission';

// Wraps the mission-completion service so every surface gets the same
// optimistic-UI behavior:
//   - tap → checkbox flips instantly
//   - second tap during the in-flight write is dropped (double-tap guard)
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

export const MissionCompletionProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { notifyMissionCompletion } = useNotifications();
  const { mutate: mutateMissions, refresh: refreshMissions } = useMissions();

  // Ref for the double-tap guard — must be synchronous so a rapid second tap
  // sees the set before React commits a state update.
  const pendingIdsRef = useRef(new Set());

  // Mirror in state so consuming components re-render when pending changes.
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [optimisticCompletedIds, setOptimisticCompletedIds] = useState(() => new Set());
  const [failedIds, setFailedIds] = useState(() => new Set());

  const errorClearTimersRef = useRef(new Map());

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
    addToSet(setOptimisticCompletedIds, missionId);

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
      removeFromSet(setOptimisticCompletedIds, missionId);
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

  const isPending = useCallback((id) => pendingIds.has(id), [pendingIds]);
  const isOptimisticallyComplete = useCallback(
    (id) => optimisticCompletedIds.has(id),
    [optimisticCompletedIds]
  );
  const hasError = useCallback((id) => failedIds.has(id), [failedIds]);

  return (
    <MissionCompletionContext.Provider value={{
      completeMission,
      isPending,
      isOptimisticallyComplete,
      hasError,
    }}>
      {children}
    </MissionCompletionContext.Provider>
  );
};
