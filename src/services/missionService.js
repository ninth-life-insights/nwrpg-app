// services/missionService.js
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDoc,
  getCountFromServer,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import dayjs from 'dayjs';
import { db } from './firebase/config';
import { MISSION_STATUS, calculateXPReward, calculateSPReward } from '../types/Mission';
import {
  calculateNextDueDate,
  calculateNextDueDateFromCompletion,
  resolveAnchorForRecurrence,
  shouldCreateNextOccurrence,
  createNextMissionInstance,
  isRecurringMission,
  isEvergreenMission
} from '../utils/recurrenceHelpers';
import {
  addXP,
  subtractXP,
  addSP,
  subtractSP,
  getUserProfile
} from './userService';
 import { logActivityEvent } from './reviewService';
import { checkAndAwardAchievements } from './achievementService';
import { addMissionToRoutine, batchAddMissionsToRoutine } from './routineService';

// Always computes from the mission's current difficulty + isDailyMission flag.
// Does NOT read any stored xpReward, so edits to difficulty before completion
// are honored (which was the source of the stale-reward bug).
const calculateTotalMissionXP = (mission) => {
  let totalXP = calculateXPReward(mission.difficulty);
  if (mission.isDailyMission) totalXP += 5;
  return totalXP;
};

// Get user's missions collection reference
const getUserMissionsRef = (userId) => {
  return collection(db, 'users', userId, 'missions');
};

// Create a new mission.
//
// options.routineId — when provided, the new mission's ID is also added to the
// given routine's missionChainIds (two-write flow: create mission, then update
// routine). If the routine update fails after the mission is created, the
// orphan mission is just a regular recurring mission with no routine
// membership — harmless, recoverable via the routine builder.
export const createMission = async (userId, missionData, options = {}) => {
  try {
    const missionsRef = getUserMissionsRef(userId);

    // Remove id field if it exists in the data being saved
    const { id, ...dataWithoutId } = missionData;

    const docRef = await addDoc(missionsRef, {
      ...dataWithoutId,  // Don't include id field in the document
      status: MISSION_STATUS.ACTIVE,
      createdAt: serverTimestamp(),
      completedAt: null
    });

    if (!docRef.id) {
      console.error('WARNING: docRef.id is null/undefined!');
    }

    if (options.routineId) {
      await addMissionToRoutine(userId, options.routineId, docRef.id);
    }

    return docRef.id;
  } catch (error) {
    console.error('Error creating mission:', error);
    throw error;
  }
};

// Get active missions
export const getActiveMissions = async (userId) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    const q = query(
      missionsRef, 
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
  } catch (error) {
    console.error('Error getting active missions:', error);
    throw error;
  }
};

// Get completed missions whose completedAt is >= sinceDate. Used by the
// routine today view to keep today's completions visible (alongside still-
// active items) so the page reads as a to-do list with progress, not a
// vanishing checklist.
export const getCompletedMissionsSince = async (userId, sinceDate) => {
  try {
    const sinceTs = Timestamp.fromDate(sinceDate);
    const missionsRef = getUserMissionsRef(userId);
    const q = query(
      missionsRef,
      where('status', '==', 'completed'),
      where('completedAt', '>=', sinceTs),
      orderBy('completedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting completed missions since date:', error);
    throw error;
  }
};

// Get completed missions
export const getCompletedMissions = async (userId) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    const q = query(
      missionsRef, 
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting completed missions:', error);
    throw error;
  }
};

// Get expired missions
export const getExpiredMissions = async (userId) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    const q = query(
      missionsRef,
      where('status', '==', 'expired'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting expired missions:', error);
    throw error;
  }
};

// Get deleted (soft-deleted) missions, most recently deleted first
export const getDeletedMissions = async (userId) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    const q = query(
      missionsRef,
      where('status', '==', MISSION_STATUS.DELETED),
      orderBy('deletedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting deleted missions:', error);
    throw error;
  }
};

// Cheap aggregate count of deleted missions — used by the settings entry point.
// Avoids the composite index that getDeletedMissions needs (where + orderBy).
export const getDeletedMissionsCount = async (userId) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    const q = query(missionsRef, where('status', '==', MISSION_STATUS.DELETED));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (error) {
    console.error('Error getting deleted missions count:', error);
    throw error;
  }
};

// Get all missions regardless of status
export const getAllMissions = async (userId) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    const q = query(missionsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(mission => mission.status !== MISSION_STATUS.DELETED);
  } catch (error) {
    console.error('Error getting all missions:', error);
    throw error;
  }
};

const completeMission = async (userId, missionId, prefetchedData = null) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);

    let missionData;
    if (prefetchedData) {
      missionData = prefetchedData;
    } else {
      const missionDoc = await getDoc(missionRef);
      if (!missionDoc.exists()) throw new Error('Mission not found');
      missionData = { ...missionDoc.data(), id: missionId };
    }

    const xpAwarded = calculateTotalMissionXP(missionData);
    // calculateSPReward returns null when there's no skill; otherwise a number.
    const spAwarded = calculateSPReward(missionData.difficulty, missionData.skill);

    // Snapshot routine membership at completion time so the routine today view
    // keeps showing this completion even if the user later removes the mission
    // from the routine mid-day. Best-effort — a failed routine fetch must not
    // block completion, so the flag falls back to false.
    let routineMemberAtCompletion = false;
    try {
      const { getRoutines } = await import('./routineService');
      const { getMissionChainRoot } = await import('../utils/routineHelpers');
      const routines = await getRoutines(userId);
      const chainRoot = getMissionChainRoot(missionData);
      if (chainRoot) {
        routineMemberAtCompletion = routines.some((r) =>
          Array.isArray(r.missionChainIds) && r.missionChainIds.includes(chainRoot)
        );
      }
    } catch (e) {
      // Best-effort. Leaving routineMemberAtCompletion=false is safe — the
      // today filter will fall back to current routine membership.
    }

    await updateDoc(missionRef, {
      status: MISSION_STATUS.COMPLETED,
      xpAwarded,
      spAwarded,
      completedAt: Timestamp.fromDate(new Date()),
      routineMemberAtCompletion
    });

    const xpResult = await addXP(userId, xpAwarded);

    let spResult = null;
    if (missionData.skill && spAwarded) {
      spResult = await addSP(userId, missionData.skill, spAwarded);
    }

    // Update quest progress if mission is part of a quest
    if (missionData.questId) {
      try {
        const { updateQuestProgress } = await import('./questService');
        await updateQuestProgress(userId, missionData.questId, missionId, true);
      } catch (error) {
        console.error('Error updating quest progress:', error);
        // Don't throw - mission is still completed even if quest update fails
      }
    }

    const completionResult = {
      xpAwarded,
      spAwarded,
      leveledUp: xpResult?.leveledUp || false,
      newLevel: xpResult?.newLevel || null,
      skillLeveledUp: spResult?.leveledUp || false,
      skillName: spResult?.skillName || null,
      newSkillLevel: spResult?.newLevel || null
    };

    // Log to activity log for daily review — fire-and-forget, never blocks completion
    await logActivityEvent(userId, { id: missionId, ...missionData }, completionResult);

    return completionResult;

  } catch (error) {
    console.error('Error completing mission:', error);
    throw error;
  }
};

// Update mission
export const updateMission = async (userId, missionId, updates) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    
    // Remove fields that shouldn't be directly updated by user-driven edits.
    // xpReward/spReward are no longer stored; xpAwarded/spAwarded are server-
    // managed at completion; isDailyMission is computed from daily config.
    const {
      id,
      createdAt,
      completedAt,
      status,
      xpAwarded,
      spAwarded,
      xpReward,
      spReward,
      isDailyMission,
      ...updateData
    } = updates;
    
    await updateDoc(missionRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });

  } catch (error) {
    console.error('Error updating mission:', error);
    throw error;
  }
};

// Delete mission
export const deleteMission = async (userId, missionId) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    const missionDoc = await getDoc(missionRef);
    
    if (!missionDoc.exists()) {
      throw new Error('Mission not found');
    }
    
    const missionData = missionDoc.data();
    
    await updateDoc(missionRef, {
      status: MISSION_STATUS.DELETED,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      scheduledDates: []
    });

    // Remove mission from quest if it's part of one
    if (missionData.questId) {
      try {
        const { removeMissionFromQuest } = await import('./questService');
        await removeMissionFromQuest(userId, missionData.questId, missionId);
      } catch (error) {
        console.error('Error removing mission from quest:', error);
        // Don't throw - mission is still deleted even if quest update fails
      }
    }

    // Remove mission from today's daily missions if it's currently selected,
    // and from any future dates it was pre-planned for via EditDailyMissionsPage.
    try {
      const { removeMissionFromDailyMissions, removeMissionFromPlannedDates } = await import('./dailyMissionService');
      await removeMissionFromDailyMissions(userId, missionId);
      await removeMissionFromPlannedDates(userId, missionId, missionData.scheduledDates);
    } catch (error) {
      console.error('Error removing mission from daily missions:', error);
      // Don't throw - mission is still deleted even if daily missions update fails
    }
  } catch (error) {
    console.error('Error deleting mission:', error);
    throw error;
  }
};

// Window during which an uncomplete is treated as "undo of a mistaken click" —
// also cleans up the just-spawned child instance, so the user doesn't end up
// with two active missions (today's restored + tomorrow's still spawned).
// Best-effort cleanup of a child instance spawned by a completion of
// `parentMission`. Runs whenever the parent is uncompleted — the time of
// completion no longer matters. Gated only by:
//   - the parent is recurring or evergreen (the only types that spawn)
//   - a child exists with the expected parentMissionId + occurrenceNumber
//   - the child shows no sign of user interaction (untouched safety net below)
//
// The safety nets (status, currentCount, actualTimeSpentMinutes, scheduledDates,
// updatedAt-after-createdAt) catch any case where the user has touched the
// child since it was spawned. If the child is still pristine, uncompletion
// semantically implies undoing the spawn — the previous time-window gate is
// redundant with these checks and just produced "duplicate card in builder"
// bugs when the undo happened later than 60s after the completion.
//
// Soft-deletes via deleteMission so the child still appears in the deleted bin
// rather than vanishing — matches the global soft-delete convention.
const cleanupRecentlySpawnedChild = async (userId, parentMission) => {
  if (!parentMission.completedAt) return;
  if (!isRecurringMission(parentMission) && !isEvergreenMission(parentMission)) return;

  const chainRoot = parentMission.parentMissionId || parentMission.id;
  const expectedOccurrence = (parentMission.occurrenceNumber || 1) + 1;

  const missionsRef = getUserMissionsRef(userId);
  const q = query(missionsRef, where('parentMissionId', '==', chainRoot));
  const snap = await getDocs(q);

  const childDoc = snap.docs.find(d => (d.data().occurrenceNumber || 0) === expectedOccurrence);
  if (!childDoc) return;

  const child = childDoc.data();

  // Safety net — leave the child alone if it shows any sign of user interaction
  if (child.status !== MISSION_STATUS.ACTIVE) return;
  if (child.currentCount) return;
  if (child.actualTimeSpentMinutes) return;
  if (Array.isArray(child.scheduledDates) && child.scheduledDates.length > 0) return;

  // updatedAt later than createdAt by more than ~1s = the user edited it
  if (child.updatedAt && child.createdAt) {
    const createdMs = child.createdAt.toDate ? child.createdAt.toDate().getTime() : 0;
    const updatedMs = child.updatedAt.toDate ? child.updatedAt.toDate().getTime() : 0;
    if (updatedMs - createdMs > 1000) return;
  }

  await deleteMission(userId, childDoc.id);
};

// Find the activity log entry that records a mission's completion. Returns the
// most recent `mission_completed` entry for this missionId, or null if none.
// Queries by missionId only (single-field index) and filters/sorts in memory —
// keeps Firestore happy without a composite index and is cheap since a single
// mission has at most a handful of entries.
const findCompletionActivityLogEntry = async (userId, missionId) => {
  const logRef = collection(db, 'users', userId, 'activityLog');
  const snap = await getDocs(query(logRef, where('missionId', '==', missionId)));
  if (snap.empty) return null;
  const completionDocs = snap.docs
    .filter(d => d.data().type === 'mission_completed')
    .sort((a, b) => {
      const ta = a.data().timestamp?.toMillis?.() ?? 0;
      const tb = b.data().timestamp?.toMillis?.() ?? 0;
      return tb - ta;
    });
  return completionDocs[0] ?? null;
};

// Uncomplete a mission (revert from completed to active)
export const uncompleteMission = async (userId, missionId) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    const missionDoc = await getDoc(missionRef);
    const missionData = missionDoc.data();

    // Determine how much XP to reverse. Prefer the actually-awarded amount
    // (xpAwarded). Fall back to recalculating from difficulty if it's missing
    // — this shouldn't happen in current code, but covers any legacy doc that
    // was completed without xpAwarded being written.
    let xpToRemove;
    if (missionData.xpAwarded != null) {
      xpToRemove = missionData.xpAwarded;
    } else {
      xpToRemove = calculateTotalMissionXP(missionData);
      console.warn(`Mission ${missionId} missing xpAwarded; recalculated to ${xpToRemove} from difficulty.`);
    }

    // SP fallback chain: spAwarded (new) → spReward (legacy completion field)
    // → recompute from difficulty + skill. Zero if no skill.
    let spToRemove;
    if (missionData.spAwarded != null) {
      spToRemove = missionData.spAwarded;
    } else if (missionData.spReward != null) {
      spToRemove = missionData.spReward;
    } else if (missionData.skill) {
      spToRemove = calculateSPReward(missionData.difficulty, missionData.skill) || 0;
      console.warn(`Mission ${missionId} missing spAwarded/spReward; recalculated to ${spToRemove} from difficulty + skill.`);
    } else {
      spToRemove = 0;
    }

    await updateDoc(missionRef, {
      status: MISSION_STATUS.ACTIVE,
      completedAt: null,
      uncompletedAt: serverTimestamp(),
      xpAwarded: null,
      spAwarded: null,
    });

    // The completion event no longer happened — scrub its activity log entry
    // so the daily story (and any future regeneration) doesn't describe the
    // mission as completed on the day it was completed.
    try {
      const logEntry = await findCompletionActivityLogEntry(userId, missionId);
      if (logEntry) {
        await deleteDoc(logEntry.ref);
      }
    } catch (error) {
      console.warn('Could not remove activity log entry for uncompleted mission:', error);
      // Don't throw — the uncomplete itself already succeeded.
    }

    if (xpToRemove > 0) {
      await subtractXP(userId, xpToRemove);
    }

    if (missionData.skill && spToRemove > 0) {
      await subtractSP(userId, missionData.skill, spToRemove);
    }

    // Update quest progress if mission is part of a quest
    if (missionData.questId) {
      try {
        const { updateQuestProgress } = await import('./questService');
        await updateQuestProgress(userId, missionData.questId, missionId, false);
      } catch (error) {
        console.error('Error updating quest progress:', error);
        // Don't throw - mission is still uncompleted even if quest update fails
      }
    }

    try {
      await cleanupRecentlySpawnedChild(userId, { id: missionId, ...missionData });
    } catch (error) {
      console.error('Error cleaning up recently-spawned child mission:', error);
      // Don't throw - the parent uncomplete already succeeded
    }

    return { xpRemoved: xpToRemove };

  } catch (error) {
    console.error('Error uncompleting mission:', error);
    throw error;
  }
};

const completeRecurringMission = async (userId, missionId, prefetchedData = null) => {
  try {
    let mission;
    if (prefetchedData) {
      mission = prefetchedData;
    } else {
      const missionRef = doc(db, 'users', userId, 'missions', missionId);
      const missionSnap = await getDoc(missionRef);
      if (!missionSnap.exists()) throw new Error('Mission not found');
      mission = { id: missionSnap.id, ...missionSnap.data() };
    }

    // Complete the current mission (handles XP, status, completion timestamp, and quest progress)
    const { xpAwarded, spAwarded, leveledUp, newLevel, skillLeveledUp, skillName, newSkillLevel } = await completeMission(userId, missionId, mission);

    // 3. Check if this is a recurring mission and should create next instance
    if (isRecurringMission(mission)) {
      const currentOccurrence = mission.occurrenceNumber || 1;

      // Resolve which anchor to use based on the user's setting + recurrence
      // shape. 'completion' uses the completion timestamp; 'dueDate' uses the
      // current due date (the existing/legacy behavior).
      let anchorMode = 'smart';
      try {
        const profile = await getUserProfile(userId);
        if (profile?.recurrenceAnchorMode) anchorMode = profile.recurrenceAnchorMode;
      } catch (e) {
        // Profile fetch failed — fall back to Smart, which is the default.
      }
      const anchor = resolveAnchorForRecurrence(mission.recurrence, anchorMode);
      const completionDateStr = dayjs().format('YYYY-MM-DD');
      const nextDueDate = anchor === 'completion'
        ? calculateNextDueDateFromCompletion(completionDateStr, mission.recurrence)
        : calculateNextDueDate(mission.dueDate, mission.recurrence);

      if (shouldCreateNextOccurrence(mission.recurrence, currentOccurrence, mission.dueDate, nextDueDate)) {
        if (nextDueDate) {
          // Create the next mission instance
          const nextMissionData = createNextMissionInstance(mission, nextDueDate);

          // Create the new mission
          const missionsRef = getUserMissionsRef(userId);
          const newMissionRef = await addDoc(missionsRef, {
            ...nextMissionData,
            createdAt: serverTimestamp()
          });

          return {
            xpAwarded,
            spAwarded,
            leveledUp,
            newLevel,
            skillLeveledUp,
            skillName,
            newSkillLevel,
            nextMissionCreated: true,
            nextMissionId: newMissionRef.id,
            nextDueDate: nextDueDate
          };
        }
      }
    }

    return {
      xpAwarded,
      spAwarded,
      leveledUp,
      newLevel,
      skillLeveledUp,
      skillName,
      newSkillLevel,
      nextMissionCreated: false
    };

  } catch (error) {
    console.error('Error completing recurring mission:', error);
    throw error;
  }
};

// Enhanced complete mission function that handles both regular and recurring missions
export const completeMissionWithRecurrence = async (userId, missionId) => {
  try {
    // Get the mission to check if it's recurring
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    const missionSnap = await getDoc(missionRef);

    if (!missionSnap.exists()) {
      throw new Error('Mission not found');
    }

    const mission = { id: missionSnap.id, ...missionSnap.data() };

    // Resolve daily mission status once using the unambiguous missionId parameter,
    // then attach it so all three completion paths get the same consistent flag.
    let isDailyMission = false;
    try {
      const { checkIsDailyMission } = await import('./dailyMissionService');
      isDailyMission = await checkIsDailyMission(userId, missionId);
    } catch (e) {
      // best-effort; don't block completion
    }
    const missionWithDaily = { ...mission, id: missionId, isDailyMission };

    let completionResult;

    // If it's an evergreen mission, complete and create a fresh instance (no due date)
    if (isEvergreenMission(mission)) {
      const { xpAwarded, spAwarded, leveledUp, newLevel, skillLeveledUp, skillName, newSkillLevel } = await completeMission(userId, missionId, missionWithDaily);

      const nextMissionData = createNextMissionInstance(mission, null);
      const missionsRef = getUserMissionsRef(userId);
      const newMissionRef = await addDoc(missionsRef, {
        ...nextMissionData,
        dueDate: null,
        createdAt: serverTimestamp(),
        // Stamp the fresh instance with the chain's most recent completion
        // timestamp so the routine rolling-window predicate
        // (isEvergreenOwedOnDate) can answer "owed?" without walking the chain.
        lastCompletedAt: serverTimestamp()
      });

      completionResult = {
        xpAwarded,
        spAwarded,
        leveledUp,
        newLevel,
        skillLeveledUp,
        skillName,
        newSkillLevel,
        nextMissionCreated: true,
        nextMissionId: newMissionRef.id
      };
    } else if (isRecurringMission(mission)) {
      // If it's a recurring mission, use the recurring logic
      completionResult = await completeRecurringMission(userId, missionId, missionWithDaily);
    } else {
      // Use the regular completion logic
      const { xpAwarded, spAwarded, leveledUp, newLevel, skillLeveledUp, skillName, newSkillLevel } = await completeMission(userId, missionId, missionWithDaily);

      completionResult = {
        xpAwarded,
        spAwarded,
        leveledUp,
        newLevel,
        skillLeveledUp,
        skillName,
        newSkillLevel,
        nextMissionCreated: false
      };
    }

    // Check for newly unlocked achievements
    let newlyAwardedAchievements = [];
    try {
      const profile = await getUserProfile(userId);
      const achievementResult = await checkAndAwardAchievements(userId, {
        difficulty: mission.difficulty,
        streak: profile?.streak ?? 0,
        skills: profile?.skills || {},
      });
      newlyAwardedAchievements = achievementResult.newlyAwarded || [];
    } catch (achievementError) {
      console.error('Achievement check failed:', achievementError);
    }
    return { ...completionResult, newlyAwardedAchievements };

  } catch (error) {
    console.error('Error completing mission with recurrence:', error);
    throw error;
  }
};

// Get all instances of a recurring mission (for tracking history)
export const getRecurringMissionInstances = async (userId, parentMissionId) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    const q = query(
      missionsRef,
      where('parentMissionId', '==', parentMissionId),
      orderBy('occurrenceNumber', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(mission => mission.status !== MISSION_STATUS.DELETED);
  } catch (error) {
    console.error('Error getting recurring mission instances:', error);
    throw error;
  }
};

// Mark mission as expired (could be run by a scheduled function).
// In this codebase, expired === archived (see archiveMission below).
export const expireMission = async (userId, missionId) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);

    // Read mission first so we can sync the quest's cached progress counts
    // if this mission belongs to a quest. Mirrors deleteMission's pattern.
    const missionSnap = await getDoc(missionRef);
    const missionData = missionSnap.exists() ? missionSnap.data() : null;

    await updateDoc(missionRef, {
      status: MISSION_STATUS.EXPIRED,
      expiredAt: serverTimestamp()
    });

    // Keep quest progress math consistent with display: QuestDetailView hides
    // archived missions, so they should also drop out of completedMissionIds
    // and the active count, otherwise numerator and denominator diverge
    // (e.g., a completed-then-archived mission would leave progress at 3/2).
    // Going through updateQuestProgress(false) — rather than touching the
    // cache directly — also lets it re-evaluate auto-complete: archiving
    // the last incomplete mission of an otherwise-done quest correctly
    // auto-completes the quest.
    if (missionData?.questId) {
      try {
        const { updateQuestProgress } = await import('./questService');
        await updateQuestProgress(userId, missionData.questId, missionId, false);
      } catch (error) {
        console.error('Error syncing quest progress on archive:', error);
        // Don't throw — mission is still archived even if quest sync fails.
      }
    }
  } catch (error) {
    console.error('Error expiring mission:', error);
    throw error;
  }
};

// Update a single mission's custom sort order
export const updateMissionCustomOrder = async (userId, missionId, customSortOrder) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    await updateDoc(missionRef, {
      customSortOrder: customSortOrder,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating mission custom order:', error);
    throw error;
  }
};

// Archive a mission (manually expire it — expired = archived)
export const archiveMission = async (userId, missionId) => {
  return expireMission(userId, missionId);
};

// Restore a mission (from archived/expired OR deleted) back to its prior
// live state. Uses completedAt as the signal for whether the mission was
// completed before archive/delete — neither expireMission nor deleteMission
// clears completedAt, so a populated value reliably means "this mission was
// in a completed state." Without this, restoring an archived-completed
// mission left it as ACTIVE with a stale completedAt timestamp.
//
// Also re-syncs the quest's cached progress so completedMissionIds and the
// active count reflect the restored mission. updateQuestProgress handles
// side effects too — e.g., reopens a quest if restoring an incomplete
// mission brings completed count below active count again.
//
// Note: a previously-deleted mission has its questId cleared by
// removeMissionFromQuest, so the quest-sync block is a no-op in the delete
// case. Only archive→restore flows go through it.
export const restoreMission = async (userId, missionId) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    const missionSnap = await getDoc(missionRef);
    const missionData = missionSnap.exists() ? missionSnap.data() : null;
    const wasCompleted = missionData?.completedAt != null;

    await updateDoc(missionRef, {
      status: wasCompleted ? MISSION_STATUS.COMPLETED : MISSION_STATUS.ACTIVE,
      expiredAt: null,
      deletedAt: null,
      updatedAt: serverTimestamp()
    });

    if (missionData?.questId) {
      try {
        const { updateQuestProgress } = await import('./questService');
        await updateQuestProgress(userId, missionData.questId, missionId, wasCompleted);
      } catch (error) {
        console.error('Error syncing quest progress on restore:', error);
        // Don't throw — mission is still restored even if quest sync fails.
      }
    }
  } catch (error) {
    console.error('Error restoring mission:', error);
    throw error;
  }
};

// Toggle the user-set "priority" flag on a mission. Used for visual emphasis
// (magenta tint) and filtering. Does not affect sort order.
export const toggleMissionPriority = async (userId, missionId) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    const snap = await getDoc(missionRef);
    if (!snap.exists()) throw new Error('Mission not found');
    const next = snap.data().isPriority !== true;
    await updateDoc(missionRef, {
      isPriority: next,
      updatedAt: serverTimestamp()
    });
    return next;
  } catch (error) {
    console.error('Error toggling mission priority:', error);
    throw error;
  }
};

// Update the completed date of a previously-completed mission. Used when the
// user retroactively says "I actually did this yesterday" (or earlier).
//
// Updates both the mission doc's `completedAt` and the matching activity log
// entry's `date` + `timestamp` in a single batch, so the corrected mission
// lands in the right day's story going forward. Time-of-day on `completedAt`
// is preserved so intra-day ordering of completions is stable.
//
// Validation:
//  - newDateString must be 'YYYY-MM-DD'
//  - cannot be in the future
//  - cannot be before the mission's createdAt
//
// Note: any daily snapshot that has already been generated for the old or new
// date is NOT auto-regenerated. The mission + activity log are the source of
// truth; a later regeneration will reflect the change.
export const updateMissionCompletedDate = async (userId, missionId, newDateString) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDateString)) {
    throw new Error('updateMissionCompletedDate requires newDateString in YYYY-MM-DD format');
  }

  const newDateDayjs = dayjs(newDateString, 'YYYY-MM-DD');
  if (!newDateDayjs.isValid()) {
    throw new Error(`updateMissionCompletedDate received invalid date: ${newDateString}`);
  }
  if (newDateDayjs.isAfter(dayjs(), 'day')) {
    throw new Error('Completed date cannot be in the future');
  }

  const missionRef = doc(db, 'users', userId, 'missions', missionId);
  const missionSnap = await getDoc(missionRef);
  if (!missionSnap.exists()) throw new Error('Mission not found');
  const missionData = missionSnap.data();

  if (missionData.status !== MISSION_STATUS.COMPLETED || !missionData.completedAt) {
    throw new Error('Only completed missions can have their completed date changed');
  }

  if (missionData.createdAt) {
    const createdAtDate = missionData.createdAt.toDate
      ? missionData.createdAt.toDate()
      : new Date(missionData.createdAt);
    if (newDateDayjs.isBefore(dayjs(createdAtDate), 'day')) {
      throw new Error('Completed date cannot be before the mission was created');
    }
  }

  // Preserve the original time-of-day so intra-day ordering of completions
  // (used by the activity log) stays consistent on the new date.
  const oldCompletedAt = missionData.completedAt.toDate
    ? missionData.completedAt.toDate()
    : new Date(missionData.completedAt);
  const newCompletedAt = new Date(
    newDateDayjs.year(),
    newDateDayjs.month(),
    newDateDayjs.date(),
    oldCompletedAt.getHours(),
    oldCompletedAt.getMinutes(),
    oldCompletedAt.getSeconds(),
    oldCompletedAt.getMilliseconds()
  );

  const newTimestamp = Timestamp.fromDate(newCompletedAt);
  const logEntry = await findCompletionActivityLogEntry(userId, missionId);

  console.log('[BACKDATE] updateMissionCompletedDate ▶', {
    missionId,
    newDateString,
    oldCompletedAt: oldCompletedAt.toISOString(),
    newCompletedAt: newCompletedAt.toISOString(),
    activityLogEntryId: logEntry?.id ?? null,
  });

  const batch = writeBatch(db);
  batch.update(missionRef, {
    completedAt: newTimestamp,
    updatedAt: serverTimestamp(),
  });
  if (logEntry) {
    batch.update(logEntry.ref, {
      date: newDateString,
      timestamp: newTimestamp,
    });
  }
  await batch.commit();

  console.log('[BACKDATE] updateMissionCompletedDate ✓ batch committed for', missionId);

  return { completedAt: newTimestamp };
};

// Batch-create multiple recurring missions and add them to a routine in one
// flow. Available for future bulk-import surfaces; the current routine
// builder uses createMission with { routineId } per-task (instant capture).
//
// Two-write flow:
//   1. Firestore writeBatch creates all N mission docs atomically.
//   2. A separate update adds the new IDs to the routine's missionChainIds.
//
// If step 2 fails after step 1 commits, the missions exist as ordinary
// recurring missions with no routine membership — harmless, recoverable via
// the routine builder's "Add existing" flow. We don't roll back step 1 because
// the cost of partial routine membership is low and the orphan missions are
// still useful on their own.
export const batchCreateRoutineMissions = async (userId, missions, routineId) => {
  if (!Array.isArray(missions) || missions.length === 0) {
    return [];
  }
  if (!routineId) {
    throw new Error('batchCreateRoutineMissions requires a routineId');
  }

  const missionsRef = getUserMissionsRef(userId);
  const batch = writeBatch(db);
  const newIds = [];

  for (const missionData of missions) {
    const { id, ...dataWithoutId } = missionData;
    const newRef = doc(missionsRef);
    batch.set(newRef, {
      ...dataWithoutId,
      status: MISSION_STATUS.ACTIVE,
      createdAt: serverTimestamp(),
      completedAt: null
    });
    newIds.push(newRef.id);
  }

  await batch.commit();

  await batchAddMissionsToRoutine(userId, routineId, newIds);

  return newIds;
};

// Batch update multiple missions' custom sort orders
export const batchUpdateMissionOrders = async (userId, updates) => {
  try {
    // updates is an array of { missionId, customSortOrder }
    const updatePromises = updates.map(({ missionId, customSortOrder }) => {
      const missionRef = doc(db, 'users', userId, 'missions', missionId);
      return updateDoc(missionRef, {
        customSortOrder: customSortOrder,
        updatedAt: serverTimestamp()
      });
    });
    
    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error batch updating mission orders:', error);
    throw error;
  }
};
