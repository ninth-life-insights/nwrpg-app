export const QUEST_STATUS = {
  PLANNING: 'planning',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

export const QUEST_DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};

export const QUEST_XP_REWARDS = {
  [QUEST_DIFFICULTY.EASY]: 10,
  [QUEST_DIFFICULTY.MEDIUM]: 20,
  [QUEST_DIFFICULTY.HARD]: 40
};

export const QUEST_SCHEMA = {
  // Core identification
  id: null,
  
  // Basic info
  title: '',
  description: '',
  status: QUEST_STATUS.PLANNING,
  
  // Difficulty and rewards
  difficulty: QUEST_DIFFICULTY.EASY,
  xpReward: null,              // Bonus XP for completing quest
  xpAwarded: null,             // Tracks if bonus XP has been given
  
  // Mission tracking
  missionIds: [],
  missionOrder: [],            // Ordered list for display/next-up logic
  completedMissionIds: [],
  
  // Progress
  totalMissions: 0,
  completedMissions: 0,
  
  // Metadata
  createdAt: null,
  updatedAt: null,
  completedAt: null,
  
  // Future features
  achievement: null,           // For achievement system
  tags: [],
  priority: 'normal',
  
  version: 1
};

export const createQuestTemplate = (overrides = {}) => {
  return {
    ...QUEST_SCHEMA,
    ...overrides,
    xpReward: overrides.xpReward || QUEST_XP_REWARDS[
      overrides.difficulty || QUEST_DIFFICULTY.EASY
    ]
  };
};