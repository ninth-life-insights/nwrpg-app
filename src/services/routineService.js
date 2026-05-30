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
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from './firebase/config';
import {
  ROUTINE_STATUS,
  DEFAULT_ROUTINE_ID,
  DEFAULT_ROUTINE_NAME,
  MAX_MISSIONS_PER_ROUTINE
} from '../types/Routine';

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
export const removeMissionFromRoutine = async (userId, routineId, chainRootId) => {
  if (!chainRootId) throw new Error('chainRootId is required');

  const routineRef = getRoutineRef(userId, routineId);
  const snap = await getDoc(routineRef);
  if (!snap.exists()) throw new Error('Routine not found');

  await updateDoc(routineRef, {
    missionChainIds: arrayRemove(chainRootId),
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
