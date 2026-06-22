// src/types/Quest.js

import dayjs from 'dayjs';

// Quest status
export const QUEST_STATUS = {
  ACTIVE: 'active',        // Quest is in progress
  COMPLETED: 'completed',  // Quest is complete
  ARCHIVED: 'archived',    // Quest is archived
  DELETED: 'deleted',      // Soft-deleted
};

// Quest difficulty levels
export const QUEST_DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};

// Quest type. 'normal' covers user-created quests. 'tutorial' marks the
// auto-seeded onboarding quest so it can be detected for achievement firing,
// the onboardingCompleted flip, and (later) tutorial-specific card rendering.
export const QUEST_TYPE = {
  NORMAL: 'normal',
  TUTORIAL: 'tutorial',
};

// XP rewards for completing quests (bonus on top of mission XP)
export const QUEST_XP_REWARDS = {
  [QUEST_DIFFICULTY.EASY]: 10,
  [QUEST_DIFFICULTY.MEDIUM]: 20,
  [QUEST_DIFFICULTY.HARD]: 40
};

// Firestore quest data schema
export const QUEST_SCHEMA = {
  // Core identification
  id: null,                           // string - Firestore document ID
  
  // Basic info
  title: '',                          // string - required
  description: '',                    // string - optional
  status: QUEST_STATUS.ACTIVE,        // string - quest status
  
  // Difficulty and rewards
  difficulty: QUEST_DIFFICULTY.EASY,  // string - quest difficulty
  xpReward: null,                     // number - bonus XP for completing quest
  xpAwarded: null,                    // number - tracks if bonus XP has been given
  
  // Mission tracking
  missionIds: [],                     // array - all mission IDs in this quest
  missionOrder: [],                   // array - ordered list for display/next-up logic
  completedMissionIds: [],            // array - completed mission IDs
  
  // Progress (cached for performance)
  totalMissions: 0,                   // number - total missions in quest
  completedMissions: 0,               // number - completed missions count
  
  // Timestamps (Firestore Timestamp objects)
  createdAt: null,                    // Timestamp - when quest was created
  updatedAt: null,                    // Timestamp - last modification
  completedAt: null,                  // Timestamp | null - when completed
  archivedAt: null,                   // Timestamp | null - when archived
  
  // Quest classification (tutorial = the onboarding "Training Grounds" quest)
  type: QUEST_TYPE.NORMAL,            // string - 'normal' | 'tutorial'

  // Future features
  achievement: null,                  // string | null - achievement ID when implemented
  tags: [],                           // array - for filtering/organization
  priority: 'normal',                 // string - 'low', 'normal', 'high'
  
  // Metadata
  version: 1                          // number - for future schema migrations
};

// Create a new quest object with default values
export const createQuestTemplate = (overrides = {}) => {
  return {
    ...QUEST_SCHEMA,
    ...overrides,
    // Ensure XP is calculated if not provided
    xpReward: overrides.xpReward || QUEST_XP_REWARDS[
      overrides.difficulty || QUEST_DIFFICULTY.EASY
    ]
  };
};

// Calculate quest progress percentage
// Pass activeMissionCount to exclude archived missions from the denominator
export const calculateQuestProgress = (quest, activeMissionCount) => {
  const total = activeMissionCount ?? quest.totalMissions;
  if (total === 0) return 0;
  return Math.round((quest.completedMissions / total) * 100);
};

// Get the next uncompleted mission in a quest.
// Primary pass walks quest.missionOrder so display follows the user's chosen
// order. Fallback pass scans the missions array directly for any uncompleted,
// non-expired, non-deleted mission belonging to this quest — guards against
// missionOrder drift (e.g., a mission that ended up in missionIds without
// landing in missionOrder), so a valid mission never silently vanishes from
// "Next up."
export const getNextMission = (quest, missions) => {
  for (const missionId of quest.missionOrder) {
    if (!quest.completedMissionIds.includes(missionId)) {
      const mission = missions.find(
        m => m.id === missionId && m.status !== 'expired' && m.status !== 'deleted'
      );
      if (mission) return mission;
    }
  }
  return missions.find(
    m => m.questId === quest.id
      && !quest.completedMissionIds.includes(m.id)
      && m.status !== 'expired'
      && m.status !== 'deleted'
  ) ?? null;
};

// Check if quest is complete (all missions done)
export const isQuestComplete = (quest) => {
  return quest.totalMissions > 0 && 
         quest.completedMissions === quest.totalMissions;
};

// Validate quest data
export const validateQuest = (quest) => {
  const errors = [];
  
  // Title validation
  if (!quest.title || quest.title.trim().length === 0) {
    errors.push('Quest title is required');
  }
  
  if (quest.title && quest.title.length > 100) {
    errors.push('Quest title must be 100 characters or less');
  }
  
  // Valid enum values
  if (!Object.values(QUEST_STATUS).includes(quest.status)) {
    errors.push('Invalid quest status');
  }
  
  if (!Object.values(QUEST_DIFFICULTY).includes(quest.difficulty)) {
    errors.push('Invalid difficulty level');
  }
  
  // Mission order should match mission IDs
  if (quest.missionOrder.length !== quest.missionIds.length) {
    errors.push('Mission order length must match mission IDs length');
  }
  
  // All missions in order should exist in missionIds
  const invalidOrderIds = quest.missionOrder.filter(
    id => !quest.missionIds.includes(id)
  );
  if (invalidOrderIds.length > 0) {
    errors.push('Mission order contains IDs not in mission list');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};