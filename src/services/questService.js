// src/services/questService.js

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

// Read caps — graceful degradation for power users.
const MAX_QUESTS = 500;
const MAX_DELETED_QUESTS = 200;
import { db } from './firebase/config';
import { checkAndAwardAchievements, awardPendingAchievement, unawardPendingAchievement } from './achievementService';
import { QUEST_STATUS, QUEST_TYPE } from '../types/Quests';
import { MISSION_STATUS } from '../types/Mission';

// Flip the user's onboardingCompleted flag — called when the tutorial quest
// reaches a terminal state (completed, archived, or deleted). Stored on the
// root user doc (users/{uid}), matching where CharacterCreationPage writes
// the initial `false`. Fire-and-forget; logged on failure.
const markOnboardingCompleted = (userId) => {
  return updateDoc(doc(db, 'users', userId), { onboardingCompleted: true })
    .catch(e => console.error('Failed to mark onboardingCompleted:', e));
};

// Fetch every tutorial mission for a quest (any status). Used by the cascade
// helpers below — tutorial missions are useless without their parent quest,
// so archive/delete/restore propagates from quest to missions.
const getTutorialMissionsForQuest = async (userId, questId) => {
  const missionsRef = collection(db, 'users', userId, 'missions');
  const q = query(missionsRef, where('questId', '==', questId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(m => m.tutorialStep);
};

// Drop the given mission ids from today's daily priorities and any future
// planned dates. Mirrors the cleanup expireMission/deleteMission do for a
// single mission. Best-effort — failures don't block the cascade itself.
const removeTutorialMissionsFromDailyPlans = async (userId, missions) => {
  if (!missions.length) return;
  try {
    const {
      removeMissionFromDailyMissions,
      removeMissionFromPlannedDates,
    } = await import('./dailyMissionService');
    await Promise.allSettled(
      missions.flatMap(m => [
        removeMissionFromDailyMissions(userId, m.id),
        m.scheduledDates?.length
          ? removeMissionFromPlannedDates(userId, m.id, m.scheduledDates)
          : Promise.resolve(),
      ])
    );
  } catch (e) {
    console.error('Tutorial mission daily-plan cleanup failed:', e);
  }
};

// Cascade: when the tutorial quest is archived, also archive all of its
// tutorial missions (set EXPIRED). Already-EXPIRED or DELETED stay as-is.
// completedAt is preserved on the doc so restoreTutorialMissions can put
// the user back into COMPLETED vs ACTIVE per the existing convention.
const cascadeArchiveTutorialMissions = async (userId, questId) => {
  const missions = await getTutorialMissionsForQuest(userId, questId);
  const targets = missions.filter(
    m => m.status !== MISSION_STATUS.EXPIRED && m.status !== MISSION_STATUS.DELETED
  );
  if (!targets.length) return;
  const batch = writeBatch(db);
  for (const m of targets) {
    batch.update(doc(db, 'users', userId, 'missions', m.id), {
      status: MISSION_STATUS.EXPIRED,
      expiredAt: serverTimestamp(),
      scheduledDates: [],
    });
  }
  await batch.commit();
  await removeTutorialMissionsFromDailyPlans(userId, targets);
};

// Cascade: tutorial quest deleted → soft-delete all tutorial missions.
const cascadeDeleteTutorialMissions = async (userId, questId) => {
  const missions = await getTutorialMissionsForQuest(userId, questId);
  const targets = missions.filter(m => m.status !== MISSION_STATUS.DELETED);
  if (!targets.length) return;
  const batch = writeBatch(db);
  for (const m of targets) {
    batch.update(doc(db, 'users', userId, 'missions', m.id), {
      status: MISSION_STATUS.DELETED,
      deletedAt: serverTimestamp(),
      scheduledDates: [],
    });
  }
  await batch.commit();
  await removeTutorialMissionsFromDailyPlans(userId, targets);
};

// Cascade: tutorial quest restored → restore its missions. Uses completedAt
// to decide ACTIVE vs COMPLETED (same convention as restoreQuest). Skips
// missions already in a live state.
const cascadeRestoreTutorialMissions = async (userId, questId) => {
  const missions = await getTutorialMissionsForQuest(userId, questId);
  const targets = missions.filter(
    m => m.status === MISSION_STATUS.EXPIRED || m.status === MISSION_STATUS.DELETED
  );
  if (!targets.length) return;
  const batch = writeBatch(db);
  for (const m of targets) {
    batch.update(doc(db, 'users', userId, 'missions', m.id), {
      status: m.completedAt ? MISSION_STATUS.COMPLETED : MISSION_STATUS.ACTIVE,
      expiredAt: null,
      deletedAt: null,
    });
  }
  await batch.commit();
};

// Collection reference
const getQuestsCollection = (userId) => {
  return collection(db, 'users', userId, 'quests');
};

// Get a single quest by ID
export const getQuest = async (userId, questId) => {
  const questRef = doc(db, 'users', userId, 'quests', questId);
  const questDoc = await getDoc(questRef);
  
  if (!questDoc.exists()) {
    throw new Error('Quest not found');
  }
  
  return {
    id: questDoc.id,
    ...questDoc.data()
  };
};

// Get all quests for a user.
// Sorted by updatedAt desc so the bank surfaces what the user most recently
// touched — newly created, last mission ticked off, last edited — at the top.
// For a fresh quest, updatedAt === createdAt so it lands first as expected.
export const getAllQuests = async (userId) => {
  const questsRef = getQuestsCollection(userId);
  const q = query(questsRef, orderBy('updatedAt', 'desc'), limit(MAX_QUESTS));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    .filter(quest => quest.status !== QUEST_STATUS.DELETED);
};

// Get quests by status
export const getQuestsByStatus = async (userId, status) => {
  const questsRef = getQuestsCollection(userId);
  const q = query(
    questsRef,
    where('status', '==', status),
    orderBy('updatedAt', 'desc'),
    limit(MAX_QUESTS)
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Get active quests
export const getActiveQuests = async (userId) => {
  return getQuestsByStatus(userId, QUEST_STATUS.ACTIVE);
};

// Get completed quests
export const getCompletedQuests = async (userId) => {
  return getQuestsByStatus(userId, QUEST_STATUS.COMPLETED);
};

// Update quest
export const updateQuest = async (userId, questId, updates) => {
  const questRef = doc(db, 'users', userId, 'quests', questId);
  
  const updateData = {
    ...updates,
    updatedAt: serverTimestamp()
  };
  
  await updateDoc(questRef, updateData);
  
  // Return updated quest
  return getQuest(userId, questId);
};

// Update quest status
export const updateQuestStatus = async (userId, questId, newStatus) => {
  const updates = { status: newStatus };

  if (newStatus === QUEST_STATUS.COMPLETED) {
    updates.completedAt = serverTimestamp();
  }

  if (newStatus === QUEST_STATUS.ARCHIVED) {
    updates.archivedAt = serverTimestamp();
  }

  return updateQuest(userId, questId, updates);
};

// Complete a quest
export const completeQuest = async (userId, questId) => {
  const quest = await getQuest(userId, questId);

  // Award XP if not already awarded
  if (!quest.xpAwarded) {
    const { addXP } = await import('./userService');
    await addXP(userId, quest.xpReward);

    await updateQuest(userId, questId, {
      status: QUEST_STATUS.COMPLETED,
      xpAwarded: quest.xpReward,
      completedAt: serverTimestamp()
    });
  } else {
    await updateQuestStatus(userId, questId, QUEST_STATUS.COMPLETED);
  }

  // Award linked achievement if present
  if (quest.achievement) {
    await awardPendingAchievement(userId, quest.achievement);
  }

  // Tutorial-specific: flip onboardingCompleted when the Training Grounds
  // quest is manually completed.
  if (quest.type === QUEST_TYPE.TUTORIAL) {
    markOnboardingCompleted(userId);
  }

  return getQuest(userId, questId);
};

// Reopen a completed quest. Inverse of completeQuest:
// - refunds the bonus XP (subtractXP floors at zero)
// - clears xpAwarded so a future re-complete awards again
// - clears completedAt so the quest doesn't show as "completed this week"
//   in the weekly review after reopen
// - unawards the linked achievement
// Idempotent: a no-op for quests that aren't currently completed.
export const reopenQuest = async (userId, questId) => {
  const quest = await getQuest(userId, questId);

  if (quest.status !== QUEST_STATUS.COMPLETED) {
    return quest;
  }

  if (quest.xpAwarded) {
    const { subtractXP } = await import('./userService');
    await subtractXP(userId, quest.xpAwarded);
  }

  if (quest.achievement) {
    await unawardPendingAchievement(userId, quest.achievement);
  }

  return updateQuest(userId, questId, {
    status: QUEST_STATUS.ACTIVE,
    completedAt: null,
    xpAwarded: null,
  });
};

// Archive a quest
export const archiveQuest = async (userId, questId) => {
  const result = await updateQuestStatus(userId, questId, QUEST_STATUS.ARCHIVED);
  // Tutorial-specific: flip onboardingCompleted + cascade archive to all
  // tutorial missions in this quest (they're useless when orphaned).
  if (result?.type === QUEST_TYPE.TUTORIAL) {
    markOnboardingCompleted(userId);
    try {
      await cascadeArchiveTutorialMissions(userId, questId);
    } catch (e) {
      console.error('Tutorial mission archive cascade failed:', e);
    }
  }
  return result;
};

// Get archived quests
export const getArchivedQuests = async (userId) => {
  return getQuestsByStatus(userId, QUEST_STATUS.ARCHIVED);
};

// Get deleted (soft-deleted) quests, most recently deleted first
export const getDeletedQuests = async (userId) => {
  try {
    const questsRef = getQuestsCollection(userId);
    const q = query(
      questsRef,
      where('status', '==', QUEST_STATUS.DELETED),
      orderBy('deletedAt', 'desc'),
      limit(MAX_DELETED_QUESTS)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting deleted quests:', error);
    throw error;
  }
};

// Cheap aggregate count of deleted quests — used by the settings entry point.
// Avoids the composite index that getDeletedQuests needs (where + orderBy).
export const getDeletedQuestsCount = async (userId) => {
  try {
    const questsRef = getQuestsCollection(userId);
    const q = query(questsRef, where('status', '==', QUEST_STATUS.DELETED));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (error) {
    console.error('Error getting deleted quests count:', error);
    throw error;
  }
};

// Restore a quest (from archived OR deleted) back to its prior live state.
// Uses completedAt as the signal for which state to restore to: reopenQuest
// clears completedAt, so a populated value reliably means "this quest was
// in a completed state at archive/delete time." Without this, restoring a
// completed-then-archived quest landed it as ACTIVE at 100% progress with
// a "Complete Quest" CTA dangling — re-tapping would re-fire the linked
// achievement award.
//
// If the quest had a linked achievement that was soft-deleted on delete,
// the achievement is also restored to pending.
export const restoreQuest = async (userId, questId) => {
  const quest = await getQuest(userId, questId);
  const wasCompleted = quest.completedAt != null;
  const questRef = doc(db, 'users', userId, 'quests', questId);
  await updateDoc(questRef, {
    status: wasCompleted ? QUEST_STATUS.COMPLETED : QUEST_STATUS.ACTIVE,
    archivedAt: null,
    deletedAt: null,
    updatedAt: serverTimestamp(),
  });
  if (quest.achievement) {
    const achRef = doc(db, 'users', userId, 'achievements', quest.achievement);
    const achSnap = await getDoc(achRef);
    if (achSnap.exists() && achSnap.data().status === 'deleted') {
      // Clearing the soft-delete sentinel is enough — isPending / awardedDate /
      // awardedAt were never overwritten by deleteQuest (it's a partial update
      // touching only status + deletedAt), so the achievement's live state
      // (awarded vs pending) is already correctly preserved underneath.
      await updateDoc(achRef, {
        status: 'pending',
        deletedAt: null,
      });
    }
  }
  // Tutorial-specific: bring back the cascaded missions too. Uses
  // completedAt on each mission doc as the COMPLETED-vs-ACTIVE signal,
  // mirroring the convention this function uses for the quest itself.
  if (quest.type === QUEST_TYPE.TUTORIAL) {
    try {
      await cascadeRestoreTutorialMissions(userId, questId);
    } catch (e) {
      console.error('Tutorial mission restore cascade failed:', e);
    }
  }
};

// Delete a quest (soft-delete — mirrors deleteMission pattern)
export const deleteQuest = async (userId, questId) => {
  const quest = await getQuest(userId, questId);
  // Soft-delete linked achievement if present
  if (quest.achievement) {
    const achRef = doc(db, 'users', userId, 'achievements', quest.achievement);
    await updateDoc(achRef, { status: 'deleted', deletedAt: serverTimestamp() });
  }
  const questRef = doc(db, 'users', userId, 'quests', questId);
  await updateDoc(questRef, { status: QUEST_STATUS.DELETED, deletedAt: serverTimestamp() });
  // Tutorial-specific: flip onboardingCompleted + cascade delete to all
  // tutorial missions in this quest (they're useless when orphaned).
  if (quest.type === QUEST_TYPE.TUTORIAL) {
    markOnboardingCompleted(userId);
    try {
      await cascadeDeleteTutorialMissions(userId, questId);
    } catch (e) {
      console.error('Tutorial mission delete cascade failed:', e);
    }
  }
};

// Add mission to quest
export const addMissionToQuest = async (userId, questId, missionId) => {
  const quest = await getQuest(userId, questId);
  
  // Check if mission already in quest
  if (quest.missionIds.includes(missionId)) {
    throw new Error('Mission already in quest');
  }
  
  const updatedMissionIds = [...quest.missionIds, missionId];
  const updatedMissionOrder = [...quest.missionOrder, missionId];
  
  await updateQuest(userId, questId, {
    missionIds: updatedMissionIds,
    missionOrder: updatedMissionOrder,
    totalMissions: updatedMissionIds.length
  });
  
  // Update the mission to link it to the quest
  const { updateMission } = await import('./missionService');
  await updateMission(userId, missionId, {
    questId: questId
  });

  return getQuest(userId, questId);
};

// Remove mission from quest
export const removeMissionFromQuest = async (userId, questId, missionId) => {
  const quest = await getQuest(userId, questId);
  
  const updatedMissionIds = quest.missionIds.filter(id => id !== missionId);
  const updatedMissionOrder = quest.missionOrder.filter(id => id !== missionId);
  const updatedCompletedIds = quest.completedMissionIds.filter(id => id !== missionId);
  
  // Recalculate completed count
  const newCompletedCount = updatedCompletedIds.length;
  
  await updateQuest(userId, questId, {
    missionIds: updatedMissionIds,
    missionOrder: updatedMissionOrder,
    completedMissionIds: updatedCompletedIds,
    totalMissions: updatedMissionIds.length,
    completedMissions: newCompletedCount
  });
  
  // Update the mission to unlink it from the quest
  const { updateMission } = await import('./missionService');
  await updateMission(userId, missionId, {
    questId: null
  });

  return getQuest(userId, questId);
};

// Reorder missions in quest
export const reorderQuestMissions = async (userId, questId, newMissionOrder) => {
  const quest = await getQuest(userId, questId);
  
  // Validate that newMissionOrder contains same missions
  if (newMissionOrder.length !== quest.missionOrder.length) {
    throw new Error('New order must contain all missions');
  }
  
  const sortedOriginal = [...quest.missionOrder].sort();
  const sortedNew = [...newMissionOrder].sort();
  if (sortedOriginal.join(',') !== sortedNew.join(',')) {
    throw new Error('New order must contain exactly the same mission IDs');
  }
  
  await updateQuest(userId, questId, {
    missionOrder: newMissionOrder
  });
  
  return getQuest(userId, questId);
};

// Count missions in a quest that are still active or completed (i.e. not archived/expired/deleted).
// Uses getCountFromServer so the count doesn't pull every doc — a quest with
// hundreds of missions used to mean hundreds of reads here.
const getActiveMissionCount = async (userId, questId) => {
  const missionsRef = collection(db, 'users', userId, 'missions');
  const q = query(
    missionsRef,
    where('questId', '==', questId),
    where('status', 'in', [MISSION_STATUS.ACTIVE, MISSION_STATUS.COMPLETED])
  );
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
};

// Update quest progress when a mission is completed/uncompleted
export const updateQuestProgress = async (userId, questId, missionId, isCompleted) => {
  const quest = await getQuest(userId, questId);
  
  let updatedCompletedIds = [...quest.completedMissionIds];
  
  if (isCompleted) {
    // Add to completed if not already there
    if (!updatedCompletedIds.includes(missionId)) {
      updatedCompletedIds.push(missionId);
    }
  } else {
    // Remove from completed
    updatedCompletedIds = updatedCompletedIds.filter(id => id !== missionId);
  }
  
  const updates = {
    completedMissionIds: updatedCompletedIds,
    completedMissions: updatedCompletedIds.length
  };

  const activeMissionCount = await getActiveMissionCount(userId, questId);

  // Auto-complete quest if all active (non-archived) missions are done
  if (updatedCompletedIds.length === activeMissionCount && activeMissionCount > 0 &&
      quest.status === QUEST_STATUS.ACTIVE) {
    updates.status = QUEST_STATUS.COMPLETED;
    updates.completedAt = serverTimestamp();

    // Award XP if not already awarded
    if (!quest.xpAwarded) {
      const { addXP } = await import('./userService');
      await addXP(userId, quest.xpReward);
      updates.xpAwarded = quest.xpReward;
    }

    // Check for quest-related achievements. Passing `quest` in context lets
    // the tutorial-complete check (and any future quest-shape-aware checks)
    // inspect quest.type without re-reading the doc.
    checkAndAwardAchievements(userId, { questCompleted: true, quest }).catch(e =>
      console.error('Achievement check failed:', e)
    );

    // Award linked quest achievement if present
    if (quest.achievement) {
      awardPendingAchievement(userId, quest.achievement).catch(e =>
        console.error('Achievement award failed:', e)
      );
    }

    // Tutorial-specific: flip onboardingCompleted when the Training Grounds
    // quest auto-completes. Mirrors the archive/delete paths below.
    if (quest.type === QUEST_TYPE.TUTORIAL) {
      markOnboardingCompleted(userId);
    }
  }

  // Reopen quest if it was auto-completed but now has incomplete active missions.
  // Mirrors reopenQuest's contract: refund XP, clear xpAwarded so a future
  // re-complete awards again, clear completedAt, unaward the achievement.
  if (quest.status === QUEST_STATUS.COMPLETED &&
      updatedCompletedIds.length < activeMissionCount) {
    updates.status = QUEST_STATUS.ACTIVE;
    updates.completedAt = null;

    if (quest.xpAwarded) {
      const { subtractXP } = await import('./userService');
      await subtractXP(userId, quest.xpAwarded);
      updates.xpAwarded = null;
    }

    if (quest.achievement) {
      unawardPendingAchievement(userId, quest.achievement).catch(e =>
        console.error('Achievement unaward failed:', e)
      );
    }
  }
  
  await updateQuest(userId, questId, updates);
  
  return getQuest(userId, questId);
};

// Batch update multiple quests (useful for bulk operations)
export const batchUpdateQuests = async (userId, updates) => {
  const batch = writeBatch(db);
  
  updates.forEach(({ questId, data }) => {
    const questRef = doc(db, 'users', userId, 'quests', questId);
    batch.update(questRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  });
  
  await batch.commit();
};
