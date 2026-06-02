// src/types/Routine.js

export const ROUTINE_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted',
};

// Fixed ID for the auto-created default routine. Mirrors ENTIRE_BASE_ROOM_ID
// from roomService — a regular doc with a known ID rather than a true singleton.
export const DEFAULT_ROUTINE_ID = 'my-routine';
export const DEFAULT_ROUTINE_NAME = 'My Routine';

// Cap on missionChainIds length. Firestore can hold far more, but arrayUnion/
// arrayRemove rewrite the whole array on every change, and realistically a
// homemaker's routine won't approach this. Soft guardrail with a friendly error.
export const MAX_MISSIONS_PER_ROUTINE = 200;

export const ROUTINE_SCHEMA = {
  id: null,                        // string - Firestore document ID

  // Basic info
  name: '',                        // string - required
  icon: null,                      // string | null - reserved for v2 UI
  color: null,                     // string | null - reserved for v2 UI
  description: null,               // string | null

  // Membership
  missionChainIds: [],             // string[] - chain ROOT mission IDs (the original
                                   // recurring mission, not child instances). Child
                                   // instances inherit membership via parentMissionId.

  // Ordering / lifecycle
  order: 0,                        // number - sort order among routines
  isDefault: false,                // boolean - true only for DEFAULT_ROUTINE_ID
  canDelete: true,                 // boolean - default routine has false
  status: ROUTINE_STATUS.ACTIVE,   // string - ACTIVE | DELETED

  // Pause / vacation mode. When pausedUntil is set and >= today, the routine
  // is hidden across routine surfaces. pausedSince records when the pause
  // was applied so resume can shift long-cycle (yearly) tasks forward by the
  // actual pause duration.
  pausedUntil: null,               // string | null - 'YYYY-MM-DD' (local time, dayjs)
  pausedSince: null,               // string | null - 'YYYY-MM-DD' (when pause was set)

  // Timestamps
  createdAt: null,                 // Timestamp
  updatedAt: null,                 // Timestamp
  deletedAt: null,                 // Timestamp | null
};

export const createRoutineTemplate = (overrides = {}) => ({
  ...ROUTINE_SCHEMA,
  ...overrides,
});
