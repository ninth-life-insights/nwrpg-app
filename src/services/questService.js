// src/services/questService.js

import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase/config';
import { checkAndAwardAchievements, awardPendingAchievement, unawardPendingAchievement } from './achievementService';
import { 
  QUEST_STATUS, 
  createQuestTemplate,
  validateQuest,
  isQuestComplete
} from '../types/Quests';

// Collection reference
const getQuestsCollection = (userId) => {
  return collection(db, 'users', userId, 'quests');
};

// Create a new quest
export const createQuest = async (userId, questData) => {
  const validation = validateQuest(questData);
  if (!validation.isValid) {
    throw new Error(`Invalid quest data: ${validation.errors.join(', ')}`);
  }

  const questTemplate = createQuestTemplate({
    ...questData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // IMPORTANT: Remove id field before saving to Firestore
  const { id, ...dataWithoutId } = questTemplate;

  const questsRef = getQuestsCollection(userId);
  const docRef = await addDoc(questsRef, dataWithoutId); // Save without id field
  
  return {
    ...dataWithoutId, // Spread the data without id first
    id: docRef.id     // Then add the real Firestore ID
  };
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

// Get all quests for a user
export const getAllQuests = async (userId) => {
  const questsRef = getQuestsCollection(userId);
  const q = query(questsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Get quests by status
export const getQuestsByStatus = async (userId, status) => {
  const questsRef = getQuestsCollection(userId);
  const q = query(
    questsRef, 
    where('status', '==', status),
    orderBy('createdAt', 'desc')
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

// Get planning quests
export const getPlanningQuests = async (userId) => {
  return getQuestsByStatus(userId, QUEST_STATUS.PLANNING);
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

// Activate a quest (move from planning to active)
export const activateQuest = async (userId, questId) => {
  const quest = await getQuest(userId, questId);
  
  if (quest.totalMissions === 0) {
    throw new Error('Cannot activate quest with no missions');
  }
  
  return updateQuestStatus(userId, questId, QUEST_STATUS.ACTIVE);
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

  return getQuest(userId, questId);
};

// Archive a quest
export const archiveQuest = async (userId, questId) => {
  return updateQuestStatus(userId, questId, QUEST_STATUS.ARCHIVED);
};

// Get archived quests
export const getArchivedQuests = async (userId) => {
  return getQuestsByStatus(userId, QUEST_STATUS.ARCHIVED);
};

// Restore an archived quest back to active
export const restoreQuest = async (userId, questId) => {
  return updateQuest(userId, questId, {
    status: QUEST_STATUS.ACTIVE,
    archivedAt: null
  });
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
    questId: questId,
    questOrder: updatedMissionOrder.length - 1
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
    questId: null,
    questOrder: null
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
  
  // Auto-complete quest if all missions are done
  if (updatedCompletedIds.length === quest.totalMissions &&
      quest.status === QUEST_STATUS.ACTIVE) {
    updates.status = QUEST_STATUS.COMPLETED;
    updates.completedAt = serverTimestamp();

    // Award XP if not already awarded
    if (!quest.xpAwarded) {
      const { addXP } = await import('./userService');
      await addXP(userId, quest.xpReward);
      updates.xpAwarded = quest.xpReward;
    }

    // Check for quest-related achievements
    checkAndAwardAchievements(userId, { questCompleted: true }).catch(e =>
      console.error('Achievement check failed:', e)
    );

    // Award linked quest achievement if present
    if (quest.achievement) {
      awardPendingAchievement(userId, quest.achievement).catch(e =>
        console.error('Achievement award failed:', e)
      );
    }
  }

  // Reopen quest if it was auto-completed but now has incomplete missions
  if (quest.status === QUEST_STATUS.COMPLETED &&
      updatedCompletedIds.length < quest.totalMissions) {
    updates.status = QUEST_STATUS.ACTIVE;
    updates.completedAt = null;

    // TODO: XP should also be unawarded here — flagged for separate fix

    // Unaward linked quest achievement
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