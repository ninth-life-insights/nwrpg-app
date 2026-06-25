import { MISSION_STATUS } from '../types/Mission';

// Pure helpers for surfaces consuming MissionCompletionContext. Used by every
// mission list to apply optimistic + server-resolved + rollback edits without
// each surface re-implementing the same map().

export const applyOptimisticCompletion = (missions, missionId) => {
  return missions.map((m) =>
    m.id === missionId
      ? { ...m, status: MISSION_STATUS.COMPLETED, completedAt: new Date() }
      : m
  );
};

// Stamp the server-returned xpAwarded / spAwarded on the local mission so any
// post-completion display (recently-completed strip, history, etc.) shows the
// real reward values. The status flip already happened optimistically.
export const applyServerResolved = (missions, missionId, result) => {
  if (!result) return missions;
  return missions.map((m) =>
    m.id === missionId
      ? {
          ...m,
          status: MISSION_STATUS.COMPLETED,
          xpAwarded: result.xpAwarded ?? m.xpAwarded ?? null,
          spAwarded: result.spAwarded ?? m.spAwarded ?? null,
        }
      : m
  );
};

export const applyCompletionRollback = (missions, missionId) => {
  return missions.map((m) => {
    if (m.id !== missionId) return m;
    const { completedAt, xpAwarded, spAwarded, ...rest } = m;
    return { ...rest, status: MISSION_STATUS.ACTIVE };
  });
};

// Mirror of applyOptimisticCompletion for the uncomplete tap. Flips status
// back to active and clears the completion-derived fields so any local list
// re-renders as "not completed" on the same tick. Shape matches what the
// server will eventually write back.
export const applyOptimisticUncompletion = (missions, missionId) => {
  return missions.map((m) => {
    if (m.id !== missionId) return m;
    const { completedAt, xpAwarded, spAwarded, ...rest } = m;
    return { ...rest, status: MISSION_STATUS.ACTIVE };
  });
};
