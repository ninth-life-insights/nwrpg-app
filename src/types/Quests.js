// src/types/Quest.js

import dayjs from 'dayjs';

// Quest status
export const QUEST_STATUS = {
  PLANNING: 'planning',    // Building out the quest
  ACTIVE: 'active',        // Quest is in progress
  COMPLETED: 'completed',  // Quest is complete
  ARCHIVED: 'archived'     // Quest is archived
};

// Quest difficulty levels
export const QUEST_DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
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
  status: QUEST_STATUS.PLANNING,      // string - quest status
  
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
export const calculateQuestProgress = (quest) => {
  if (quest.totalMissions === 0) return 0;
  return Math.round((quest.completedMissions / quest.totalMissions) * 100);
};

// Get the next uncompleted mission in a quest
export const getNextMission = (quest, missions) => {
  // Find first mission in missionOrder that's not in completedMissionIds
  for (const missionId of quest.missionOrder) {
    if (!quest.completedMissionIds.includes(missionId)) {
      const mission = missions.find(m => m.id === missionId);
      if (mission) return mission;
    }
  }
  return null;
};

// Check if quest is complete (all missions done)
export const isQuestComplete = (quest) => {
  return quest.totalMissions > 0 && 
         quest.completedMissions === quest.totalMissions;
};

// Check if quest can be activated (has at least one mission)
export const canActivateQuest = (quest) => {
  return quest.status === QUEST_STATUS.PLANNING && 
         quest.totalMissions > 0;
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