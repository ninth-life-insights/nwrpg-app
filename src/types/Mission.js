// src/types/Mission.js

/**
 * Mission completion types
 */
export const COMPLETION_TYPES = {
  SIMPLE: 'simple',     // Basic toggle completion
  TIMER: 'timer',       // Time-based missions (e.g., "meditate for 10 minutes")
  COUNT: 'count'        // Count-based missions (e.g., "drink 8 glasses of water")
};

/**
 * Mission status values
 */
export const MISSION_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  PAUSED: 'paused'      // For future use
};

/**
 * Mission difficulty levels
 */
export const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium', 
  HARD: 'hard'
};

/**
 * Mission categories
 */
export const MISSION_CATEGORIES = {
  PERSONAL: 'personal',
  HEALTH: 'health',
  HOME: 'home',
  WORK: 'work',
  LEARNING: 'learning',
  SOCIAL: 'social'
};

/**
 * XP reward mapping by difficulty
 */
export const XP_REWARDS = {
  [DIFFICULTY_LEVELS.EASY]: 5,
  [DIFFICULTY_LEVELS.MEDIUM]: 10,
  [DIFFICULTY_LEVELS.HARD]: 20
};

/**
 * Complete mission data structure
 * This represents what should be stored in Firestore
 */
export const MISSION_SCHEMA = {
  // Core identification
  id: null,                           // string - Firestore document ID
  
  // Basic mission info
  title: '',                          // string - required
  description: '',                    // string - optional
  status: MISSION_STATUS.ACTIVE,      // string - mission status
  
  // Difficulty and rewards
  difficulty: DIFFICULTY_LEVELS.EASY, // string - mission difficulty
  xpReward: null,                     // number - calculated based on difficulty/completion type
  
  // Timestamps (Firestore Timestamp objects)
  createdAt: null,                    // Timestamp - when mission was created
  updatedAt: null,                    // Timestamp - last modification
  dueDate: null,                      // Timestamp | null - optional due date
  expiryDate: null,                   // Timestamp | null - optional expiry
  completedAt: null,                  // Timestamp | null - when completed
  
  // Categorization
  category: MISSION_CATEGORIES.PERSONAL, // string - mission category
  skill: null,                        // string | null - associated skill
  
  // Completion mechanics
  completionType: COMPLETION_TYPES.SIMPLE, // string - how mission is completed
  
  // Timer-based completion (when completionType === 'timer')
  timerDurationMinutes: null,         // number | null - target time in minutes
  actualTimeSpentMinutes: null,       // number | null - actual time spent
  
  // Count-based completion (when completionType === 'count') 
  targetCount: null,                  // number | null - target count to reach
  currentCount: 0,                    // number - current progress count
  
  // RPG elements
  isDailyMission: false,              // boolean - is this a daily mission
  
  // Future expansion fields
  tags: [],                           // array - for filtering/organization
  priority: 'normal',                 // string - 'low', 'normal', 'high'
  estimatedMinutes: null,             // number | null - estimated time to complete
  
  // Metadata
  version: 1                          // number - for future schema migrations
};

/**
 * Create a new mission object with default values
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} - New mission object
 */
export const createMissionTemplate = (overrides = {}) => {
  return {
    ...MISSION_SCHEMA,
    ...overrides,
    // Ensure XP is calculated if not provided
    xpReward: overrides.xpReward || calculateXPReward(
      overrides.difficulty || DIFFICULTY_LEVELS.EASY,
      overrides.completionType || COMPLETION_TYPES.SIMPLE
    )
  };
};

/**
 * Calculate XP reward based on difficulty and completion type
 * @param {string} difficulty - Mission difficulty
 * @param {string} completionType - How mission is completed
 * @returns {number} - XP reward amount
 */
export const calculateXPReward = (difficulty, completionType) => {
  let baseXP = XP_REWARDS[difficulty] || XP_REWARDS[DIFFICULTY_LEVELS.EASY];
  
  // Bonus XP for more complex completion types
  const completionMultiplier = {
    [COMPLETION_TYPES.SIMPLE]: 1.0,
    [COMPLETION_TYPES.TIMER]: 1.2,   // 20% bonus for timed missions
    [COMPLETION_TYPES.COUNT]: 1.1    // 10% bonus for counted missions
  };
  
  return Math.round(baseXP * (completionMultiplier[completionType] || 1.0));
};

/**
 * Validate mission data structure
 * @param {Object} mission - Mission object to validate
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
export const validateMission = (mission) => {
  const errors = [];
  
  // Required fields
  if (!mission.title || mission.title.trim().length === 0) {
    errors.push('Mission title is required');
  }
  
  if (mission.title && mission.title.length > 100) {
    errors.push('Mission title must be 100 characters or less');
  }
  
  // Valid enum values
  if (!Object.values(MISSION_STATUS).includes(mission.status)) {
    errors.push('Invalid mission status');
  }
  
  if (!Object.values(DIFFICULTY_LEVELS).includes(mission.difficulty)) {
    errors.push('Invalid difficulty level');
  }
  
  if (!Object.values(COMPLETION_TYPES).includes(mission.completionType)) {
    errors.push('Invalid completion type');
  }
  
  // Completion type specific validation
  if (mission.completionType === COMPLETION_TYPES.TIMER) {
    if (!mission.timerDurationMinutes || mission.timerDurationMinutes <= 0) {
      errors.push('Timer duration must be greater than 0');
    }
  }
  
  if (mission.completionType === COMPLETION_TYPES.COUNT) {
    if (!mission.targetCount || mission.targetCount <= 0) {
      errors.push('Target count must be greater than 0');
    }
    if (mission.currentCount < 0) {
      errors.push('Current count cannot be negative');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Check if mission is overdue
 * @param {Object} mission - Mission object
 * @returns {boolean} - True if mission is overdue
 */
export const isMissionOverdue = (mission) => {
  if (!mission.dueDate || mission.status === MISSION_STATUS.COMPLETED) {
    return false;
  }
  
  const now = new Date();
  const dueDate = mission.dueDate.toDate ? mission.dueDate.toDate() : new Date(mission.dueDate);
  
  return now > dueDate;
};

/**
 * Check if mission is expired
 * @param {Object} mission - Mission object  
 * @returns {boolean} - True if mission is expired
 */
export const isMissionExpired = (mission) => {
  if (!mission.expiryDate) {
    return false;
  }
  
  const now = new Date();
  const expiryDate = mission.expiryDate.toDate ? mission.expiryDate.toDate() : new Date(mission.expiryDate);
  
  return now > expiryDate;
};

/**
 * Check if mission can be completed based on its completion type
 * @param {Object} mission - Mission object
 * @returns {boolean} - True if mission can be marked complete
 */
export const canCompleteMission = (mission) => {
  if (mission.status === MISSION_STATUS.COMPLETED || mission.status === MISSION_STATUS.EXPIRED) {
    return false;
  }
  
  switch (mission.completionType) {
    case COMPLETION_TYPES.SIMPLE:
      return true;
      
    case COMPLETION_TYPES.TIMER:
      return mission.actualTimeSpentMinutes >= mission.timerDurationMinutes;
      
    case COMPLETION_TYPES.COUNT:
      return mission.currentCount >= mission.targetCount;
      
    default:
      return true;
  }
};