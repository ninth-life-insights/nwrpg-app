// src/types/Mission.js

import dayjs from 'dayjs';
import { fromDateString } from '../utils/dateHelpers';

// Mission completion and due dates
export const COMPLETION_TYPES = {
  SIMPLE: 'simple',     // Basic toggle completion
  TIMER: 'timer',       // Time-based missions (e.g., "meditate for 10 minutes")
  COUNT: 'count'        // Count-based missions (e.g., "drink 8 glasses of water")
};

export const DUE_TYPES = {
    UNIQUE: 'unique',
    EVERGREEN: 'evergreen',
    RECURRING: 'recurring',
}

export const MISSION_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  DELETED: 'deleted'
};

// XP and SP
export const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium', 
  HARD: 'hard'
};

export const XP_REWARDS = {
  [DIFFICULTY_LEVELS.EASY]: 5,
  [DIFFICULTY_LEVELS.MEDIUM]: 10,
  [DIFFICULTY_LEVELS.HARD]: 20
};

export const SP_REWARDS = {
    [DIFFICULTY_LEVELS.EASY]: 3,
    [DIFFICULTY_LEVELS.MEDIUM]: 6,
    [DIFFICULTY_LEVELS.HARD]: 12
}



// Firestore mission data schema
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
  xpAwarded: null,                    // number - keeps track of XP given if task is completed
  skill: null,                        // string | null - associated skill
  spReward: null,
  
  // Timestamps (Firestore Timestamp objects)
  createdAt: null,                    // Timestamp - when mission was created
  updatedAt: null,                    // Timestamp - last modification
  dueDate: '',                      // dayjs string
  expiryDate: '',                   // should be dayjs string
  completedAt: null,                  // Timestamp | null - when completed

  // Repetition data
  dueType: DUE_TYPES.UNIQUE,              // string - completion/due date type

  recurrence: {
  pattern: null,                // string - 'daily', 'weekly', 'monthly', 'yearly', 'custom'
  interval: 1,                  // number - every X days/weeks/months (e.g., every 2 weeks)
  weekdays: [],                 // array - [0,1,2,3,4,5,6] for weekly (0=Sunday)
  dayOfMonth: null,             // number - for monthly (1-31) or null for "same day"
  endDate: null,                // Date - when to stop recurring (optional)
  maxOccurrences: null,         // number - max times to recur (optional)
  parentMissionId: null,        // string - ID of original recurring mission
  nextDueDate: null,            // Date - when next instance should be created
  },

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
  quest: null,                        // object - if part of a quest
  questID: null,                      // number - order in quest
  forPartyMember: null,               // object - party member
  byPartyMember: null,
  baseLocation: null,
  
  // Future expansion fields
  tags: [],                           // array - for filtering/organization
  priority: 'normal',                 // string - 'low', 'normal', 'high'
  pinned: false,
  
  // Metadata
  version: 1                          // number - for future schema migrations
};



// Create a new mission object with default values

export const createMissionTemplate = (overrides = {}) => {
  return {
    ...MISSION_SCHEMA,
    ...overrides,
    // Ensure XP is calculated if not provided
    xpReward: overrides.xpReward || calculateXPReward(
      overrides.difficulty || DIFFICULTY_LEVELS.EASY,
      overrides.completionType || COMPLETION_TYPES.SIMPLE
    ),

    // spReward: overrides.spReward || calculateSPReward(difficulty, skill)
  };
};


// XP and SP reward helper functions

export const calculateXPReward = (difficulty) => {
  let XP = XP_REWARDS[difficulty] || XP_REWARDS[DIFFICULTY_LEVELS.EASY];
  
  return XP;
};

export const calculateSPReward = (difficulty, skill) => {
    if (skill) {
        return SP_REWARDS[difficulty] || SP_REWARDS[DIFFICULTY_LEVELS.EASY];
    }
    return null;
}

export const calculateTotalMissionXP = (mission) => {
  let totalXP = mission.xpReward; // Base XP from difficulty
  
  // Add daily mission bonus
  if (mission.isDailyMission) {
    totalXP += 5;
  }
  
  return totalXP;
};


// validates missions
export const validateMission = (mission) => {
  const errors = [];
  
  // Existing validation...
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

  if (!Object.values(DUE_TYPES).includes(mission.dueType)) {
    errors.push('Invalid due type');
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
  
  // UPDATED: Recurrence validation using dueType
  if (mission.dueType === DUE_TYPES.RECURRING) {
    // if (!mission.dueDate || mission.dueDate === '') {
    //   errors.push('Recurring missions must have a due date');
    // }
    
    if (mission.recurrence && mission.recurrence.pattern === 'weekly' && mission.recurrence.weekdays.length === 0) {
      errors.push('Weekly recurring missions must have at least one weekday selected');
    }
    
    if (mission.recurrence && mission.recurrence.interval < 1) {
      errors.push('Recurrence interval must be at least 1');
    }
    
    if (mission.recurrence && mission.recurrence.maxOccurrences && mission.recurrence.maxOccurrences < 1) {
      errors.push('Maximum occurrences must be at least 1');
    }
    
    if (mission.recurrence && mission.recurrence.endDate && mission.dueDate) {
      const endDate = new Date(mission.recurrence.endDate);
      const dueDate = new Date(mission.dueDate);
      
      if (endDate <= dueDate) {
        errors.push('Recurrence end date must be after the due date');
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// check if mission is expired
export const isMissionExpired = (mission) => {
  if (!mission.expiryDate || mission.expiryDate === '') {
    return false;
  }
  
  const now = dayjs();
  const expiryDate = fromDateString(mission.expiryDate); // Convert from YYYY-MM-DD string to dayjs
  
  return now.isAfter(expiryDate, 'day');
};

// Check if mission has a skill
export const hasSkill = (mission) => {
  return mission.skill && 
         typeof mission.skill === 'string' && 
         mission.skill.trim().length > 0;
};


// Check if mission is part of a quest
export const isQuestMission = (mission) => {
  return mission.quest !== null || mission.questID !== null;
};


// Check if mission involves party members
export const isPartyMission = (mission) => {
  return mission.forPartyMember !== null || mission.byPartyMember !== null;
};

// check if mission can be completed based on completion type

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

