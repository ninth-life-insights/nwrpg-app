// services/missionService.js
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  getCountFromServer,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase/config';
import { MISSION_STATUS, calculateXPReward, calculateSPReward } from '../types/Mission';
import {
  calculateNextDueDate,
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

// Create a new mission
export const createMission = async (userId, missionData) => {
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

    await updateDoc(missionRef, {
      status: MISSION_STATUS.COMPLETED,
      xpAwarded,
      spAwarded,
      completedAt: Timestamp.fromDate(new Date()),
      excludeFromStory: false
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
      updatedAt: serverTimestamp()
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
  } catch (error) {
    console.error('Error deleting mission:', error);
    throw error;
  }
};

// Window during which an uncomplete is treated as "undo of a mistaken click" —
// also cleans up the just-spawned child instance, so the user doesn't end up
// with two active missions (today's restored + tomorrow's still spawned).
const RECENT_COMPLETION_UNDO_WINDOW_MS = 60 * 1000;

// Best-effort cleanup of a child instance spawned by a recent completion of
// `parentMission`. Only runs if:
//   - completion was within RECENT_COMPLETION_UNDO_WINDOW_MS
//   - the parent is recurring or evergreen (the only types that spawn)
//   - a child exists with the expected parentMissionId + occurrenceNumber
//   - the child shows no sign of user interaction (untouched safety net)
// Soft-deletes via deleteMission so the child still appears in the deleted bin
// rather than vanishing — matches the global soft-delete convention.
const cleanupRecentlySpawnedChild = async (userId, parentMission) => {
  const { completedAt } = parentMission;
  if (!completedAt) return;

  const completedMs = completedAt.toDate ? completedAt.toDate().getTime() : new Date(completedAt).getTime();
  if (Date.now() - completedMs > RECENT_COMPLETION_UNDO_WINDOW_MS) return;

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
      excludeFromStory: false,
    });

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

      if (shouldCreateNextOccurrence(mission.recurrence, currentOccurrence, mission.dueDate)) {
        const nextDueDate = calculateNextDueDate(mission.dueDate, mission.recurrence);

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
        createdAt: serverTimestamp()
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

// Mark mission as expired (could be run by a scheduled function)
export const expireMission = async (userId, missionId) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    await updateDoc(missionRef, {
      status: MISSION_STATUS.EXPIRED,
      expiredAt: serverTimestamp()
    });
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

// Restore a mission (from archived/expired OR deleted) back to active
export const restoreMission = async (userId, missionId) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    await updateDoc(missionRef, {
      status: MISSION_STATUS.ACTIVE,
      expiredAt: null,
      deletedAt: null,
      updatedAt: serverTimestamp()
    });
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

// Toggle whether a completed mission should be used as material for generated story text.
// XP, SP, activity logs, and review totals still count normally.
export const toggleMissionStoryExclusion = async (userId, missionId) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    const snap = await getDoc(missionRef);
    if (!snap.exists()) throw new Error('Mission not found');
    const isCurrentlyExcluded = snap.data().excludeFromStory === true;
    await updateDoc(missionRef, {
      excludeFromStory: !isCurrentlyExcluded,
      updatedAt: serverTimestamp()
    });
    return !isCurrentlyExcluded;
  } catch (error) {
    console.error('Error toggling mission story exclusion:', error);
    throw error;
  }
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
