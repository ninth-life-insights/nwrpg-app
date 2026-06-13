// src/services/routineService.js
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  writeBatch,
  deleteField
} from 'firebase/firestore';
import dayjs from 'dayjs';
import { db } from './firebase/config';
import {
  ROUTINE_STATUS,
  DEFAULT_ROUTINE_ID,
  DEFAULT_ROUTINE_NAME,
  MAX_MISSIONS_PER_ROUTINE
} from '../types/Routine';
import { recalcDueDateForResume } from '../utils/routineHelpers';

const getUserRoutinesRef = (userId) =>
  collection(db, 'users', userId, 'routines');

const getRoutineRef = (userId, routineId) =>
  doc(db, 'users', userId, 'routines', routineId);

// Lazily create the default routine. Mirrors initializeEntireBaseRoom — a
// regular doc with a fixed ID. Called by RoutinesPage on mount and by the
// AddMissionCard "Add to routine" toggle on first use. NOT called eagerly on
// app load — we don't want to seed Firestore for users who never engage with
// the feature.
export const getOrCreateDefaultRoutine = async (userId) => {
  const routineRef = getRoutineRef(userId, DEFAULT_ROUTINE_ID);
  const snap = await getDoc(routineRef);

  if (!snap.exists()) {
    await setDoc(routineRef, {
      name: DEFAULT_ROUTINE_NAME,
      icon: null,
      color: null,
      description: null,
      missionChainIds: [],
      cadenceByChainRoot: {},
      order: 0,
      isDefault: true,
      canDelete: false,
      status: ROUTINE_STATUS.ACTIVE,
      pausedUntil: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    const freshSnap = await getDoc(routineRef);
    return { id: freshSnap.id, ...freshSnap.data() };
  }

  return { id: snap.id, ...snap.data() };
};

// Fetch all active routines, sorted by order ascending.
export const getRoutines = async (userId) => {
  const routinesRef = getUserRoutinesRef(userId);
  const q = query(routinesRef, orderBy('order', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.status !== ROUTINE_STATUS.DELETED);
};

// Fetch a single routine by ID.
export const getRoutine = async (userId, routineId) => {
  const snap = await getDoc(getRoutineRef(userId, routineId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

// Create a user-named routine. Reserved for v2 (the v1 UI only ships with the
// default routine), but the service exists so console-driven verification
// can exercise it.
export const createRoutine = async (userId, routineData) => {
  const routines = await getRoutines(userId);
  const maxOrder = routines.length > 0
    ? Math.max(...routines.map((r) => r.order || 0))
    : 0;

  const routinesRef = getUserRoutinesRef(userId);
  const docRef = await addDoc(routinesRef, {
    name: routineData.name,
    icon: routineData.icon || null,
    color: routineData.color || null,
    description: routineData.description || null,
    missionChainIds: [],
    cadenceByChainRoot: {},
    order: maxOrder + 1,
    isDefault: false,
    canDelete: true,
    status: ROUTINE_STATUS.ACTIVE,
    pausedUntil: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return docRef.id;
};

// Update a routine. Protects name/canDelete/isDefault on the default routine.
export const updateRoutine = async (userId, routineId, updates) => {
  const routineRef = getRoutineRef(userId, routineId);
  const snap = await getDoc(routineRef);

  if (!snap.exists()) throw new Error('Routine not found');

  const routineData = snap.data();

  if (routineData.isDefault) {
    const protectedFields = ['name', 'canDelete', 'isDefault'];
    for (const f of protectedFields) {
      if (updates[f] !== undefined) {
        throw new Error('Cannot modify protected fields on the default routine');
      }
    }
  }

  await updateDoc(routineRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });

  return { success: true };
};

// Soft-delete a routine. Blocks if canDelete is false (default routine).
export const deleteRoutine = async (userId, routineId) => {
  const routineRef = getRoutineRef(userId, routineId);
  const snap = await getDoc(routineRef);

  if (!snap.exists()) throw new Error('Routine not found');

  const routineData = snap.data();
  if (!routineData.canDelete) {
    throw new Error('This routine cannot be deleted');
  }

  await updateDoc(routineRef, {
    status: ROUTINE_STATUS.DELETED,
    deletedAt: serverTimestamp()
  });

  return { success: true };
};

// Add a single chain root to a routine. Uses arrayUnion so concurrent writes
// from another device don't clobber each other. arrayUnion is also idempotent —
// re-adding an existing ID is a no-op without error.
export const addMissionToRoutine = async (userId, routineId, chainRootId) => {
  if (!chainRootId) throw new Error('chainRootId is required');

  const routineRef = getRoutineRef(userId, routineId);
  const snap = await getDoc(routineRef);
  if (!snap.exists()) throw new Error('Routine not found');

  const current = snap.data().missionChainIds || [];

  // Cap check applies only when adding a new ID — re-adding an existing ID
  // (no-op via arrayUnion) shouldn't be blocked by the cap.
  if (!current.includes(chainRootId) && current.length >= MAX_MISSIONS_PER_ROUTINE) {
    throw new Error(
      `That routine is full (max ${MAX_MISSIONS_PER_ROUTINE} missions). Remove something before adding more.`
    );
  }

  await updateDoc(routineRef, {
    missionChainIds: arrayUnion(chainRootId),
    updatedAt: serverTimestamp()
  });

  return { success: true };
};

// Remove a chain root from a routine. arrayRemove is concurrency-safe.
// Also clears any cadence entry for the removed chain root so the map stays
// sparse (no orphan keys pointing at missions no longer in this routine).
export const removeMissionFromRoutine = async (userId, routineId, chainRootId) => {
  if (!chainRootId) throw new Error('chainRootId is required');

  const routineRef = getRoutineRef(userId, routineId);
  const snap = await getDoc(routineRef);
  if (!snap.exists()) throw new Error('Routine not found');

  await updateDoc(routineRef, {
    missionChainIds: arrayRemove(chainRootId),
    [`cadenceByChainRoot.${chainRootId}`]: deleteField(),
    updatedAt: serverTimestamp()
  });

  return { success: true };
};

// Set (or clear) the routine-level cadence for one chain root. Used by the
// builder's drag-between-buckets flow. Pass `cadence = null` (or daily/1) to
// clear — the entry is removed via deleteField so the default "daily" behavior
// is the absence of a key, keeping the map sparse.
//
// Cadence shape: { pattern: 'daily'|'weekly'|'monthly'|'yearly', interval: 1+ }
// Only evergreen missions consume this; recurring missions ignore the map.
export const setRoutineMissionCadence = async (userId, routineId, chainRootId, cadence) => {
  if (!chainRootId) throw new Error('chainRootId is required');

  const routineRef = getRoutineRef(userId, routineId);
  const snap = await getDoc(routineRef);
  if (!snap.exists()) throw new Error('Routine not found');

  const isDefaultDaily =
    !cadence ||
    (cadence.pattern === 'daily' && (cadence.interval ?? 1) === 1);

  await updateDoc(routineRef, {
    [`cadenceByChainRoot.${chainRootId}`]: isDefaultDaily
      ? deleteField()
      : { pattern: cadence.pattern, interval: cadence.interval ?? 1 },
    updatedAt: serverTimestamp()
  });

  return { success: true };
};

// Replace the routine's missionChainIds with an explicit new order. Used by
// the builder's drag-to-reorder flow — the array order IS the canonical
// sort order for cards on routine surfaces, so reordering means writing the
// new array as-is.
//
// Concurrency note: this overwrites the whole array (no arrayUnion), so a
// concurrent add from another device could be lost if the user reorders
// while the other device is mid-add. Acceptable trade-off for single-user
// v1; revisit when party / shared chore charts arrive.
export const reorderRoutineMissions = async (userId, routineId, orderedChainRootIds) => {
  if (!Array.isArray(orderedChainRootIds)) {
    throw new Error('orderedChainRootIds must be an array');
  }
  const routineRef = getRoutineRef(userId, routineId);
  const snap = await getDoc(routineRef);
  if (!snap.exists()) throw new Error('Routine not found');

  await updateDoc(routineRef, {
    missionChainIds: orderedChainRootIds,
    updatedAt: serverTimestamp()
  });

  return { success: true };
};

// Pause the routine until a given date (YYYY-MM-DD). Hides the routine
// across surfaces until that date passes. Also stamps pausedSince = today
// so resume math can shift long-cycle (yearly) tasks by the actual pause
// duration without catapulting them a full year out.
//
// Validation:
//   - pausedUntilDate must parse as a valid date
//   - must be strictly after today (today as end date would degenerate to
//     a no-op pause)
export const pauseRoutine = async (userId, routineId, pausedUntilDate) => {
  if (!pausedUntilDate) {
    throw new Error('pausedUntilDate is required');
  }
  const until = dayjs(pausedUntilDate);
  if (!until.isValid()) {
    throw new Error('pausedUntilDate must be a valid date');
  }
  const today = dayjs().startOf('day');
  if (!until.isAfter(today, 'day')) {
    throw new Error('Pause end date must be after today');
  }

  const routineRef = getRoutineRef(userId, routineId);
  const snap = await getDoc(routineRef);
  if (!snap.exists()) throw new Error('Routine not found');

  await updateDoc(routineRef, {
    pausedUntil: until.format('YYYY-MM-DD'),
    pausedSince: today.format('YYYY-MM-DD'),
    updatedAt: serverTimestamp()
  });

  return { success: true };
};

// Resume a paused routine. Clears the pause fields AND recalculates each
// routine mission's dueDate so tasks "wake up" at the next natural occurrence
// rather than sitting stale at their pre-pause due dates.
//
// Recalc strategy (see recalcDueDateForResume):
//   - Daily / Weekly / Monthly → snap to next matching occurrence on/after
//     today (cycle-aware)
//   - Yearly → shift by pause duration in days (avoids pushing the task out
//     a whole year for a short pause)
//
// Idempotent: calling resume on a not-paused routine just clears any stale
// pause fields and returns without recalc. Auto-resume callers (page loads
// detecting expired pausedUntil) can rely on this safely.
export const resumeRoutine = async (userId, routineId) => {
  const routineRef = getRoutineRef(userId, routineId);
  const snap = await getDoc(routineRef);
  if (!snap.exists()) throw new Error('Routine not found');

  const routine = snap.data();
  const pausedSince = routine.pausedSince;
  const chainRootIds = Array.isArray(routine.missionChainIds)
    ? routine.missionChainIds
    : [];

  // No pause to resume from (or nothing to recalc) — just clear any stale
  // pause fields and bail.
  if (!pausedSince || chainRootIds.length === 0) {
    await updateDoc(routineRef, {
      pausedUntil: null,
      pausedSince: null,
      updatedAt: serverTimestamp()
    });
    return { success: true, missionsUpdated: 0 };
  }

  // Fetch all active missions and filter to routine members. Firestore can't
  // cleanly OR across parentMissionId and id in a single query, so we do the
  // chain-root resolution client-side.
  const missionsRef = collection(db, 'users', userId, 'missions');
  // Matches MAX_ACTIVE_MISSIONS in missionService — guardrail, not a product cap.
  const activeQ = query(missionsRef, where('status', '==', 'active'), limit(500));
  const missionsSnap = await getDocs(activeQ);
  const activeMissions = missionsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data()
  }));

  const chainRootSet = new Set(chainRootIds);
  const routineMissions = activeMissions.filter((m) => {
    const root = m.parentMissionId || m.id;
    return chainRootSet.has(root);
  });

  const today = dayjs().startOf('day');
  const since = dayjs(pausedSince).startOf('day');
  const shiftDays = Math.max(0, today.diff(since, 'day'));

  // Recalc each routine mission's dueDate and pack the writes into a single
  // batch with the pause-clear update on the routine doc, so resume is
  // atomic from the user's point of view.
  const batch = writeBatch(db);
  let updated = 0;
  for (const m of routineMissions) {
    const newDueDate = recalcDueDateForResume(m, today, shiftDays);
    if (newDueDate && newDueDate !== m.dueDate) {
      const missionRef = doc(db, 'users', userId, 'missions', m.id);
      batch.update(missionRef, {
        dueDate: newDueDate,
        updatedAt: serverTimestamp()
      });
      updated++;
    }
  }

  batch.update(routineRef, {
    pausedUntil: null,
    pausedSince: null,
    updatedAt: serverTimestamp()
  });

  await batch.commit();

  return { success: true, missionsUpdated: updated };
};

// Convenience: is this routine currently paused (pausedUntil is set and
// has not yet been reached)? Caller passes the routine doc directly; this
// is a pure check, not a Firestore read.
//
// YYYY-MM-DD strings sort lexicographically, which matches calendar order,
// so we compare strings directly without parsing through dayjs.
export const isRoutinePaused = (routine, asOfDate = null) => {
  if (!routine || !routine.pausedUntil) return false;
  const todayStr = asOfDate
    ? dayjs(asOfDate).format('YYYY-MM-DD')
    : dayjs().format('YYYY-MM-DD');
  return routine.pausedUntil >= todayStr;
};

// Batch-add multiple chain roots in one update. Used by the routine builder's
// "Add existing recurring" multi-select flow and by batchCreateRoutineMissions.
// Enforces the cap against the union of existing + new IDs.
export const batchAddMissionsToRoutine = async (userId, routineId, chainRootIds) => {
  if (!chainRootIds || chainRootIds.length === 0) return { success: true };

  const routineRef = getRoutineRef(userId, routineId);
  const snap = await getDoc(routineRef);
  if (!snap.exists()) throw new Error('Routine not found');

  const current = snap.data().missionChainIds || [];
  const trulyNew = chainRootIds.filter((id) => !current.includes(id));

  if (current.length + trulyNew.length > MAX_MISSIONS_PER_ROUTINE) {
    throw new Error(
      `That batch would exceed the routine's cap of ${MAX_MISSIONS_PER_ROUTINE} missions. Remove something or split the batch.`
    );
  }

  await updateDoc(routineRef, {
    missionChainIds: arrayUnion(...chainRootIds),
    updatedAt: serverTimestamp()
  });

  return { success: true };
};
