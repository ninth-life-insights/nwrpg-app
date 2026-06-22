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
  xpAwarded: null,                    // number | null - XP granted at completion (server-managed)
  spAwarded: null,                    // number | null - SP granted at completion (server-managed)
  skill: null,                        // string | null - associated skill
  
  // Timestamps (Firestore Timestamp objects)
  createdAt: null,                    // Timestamp - when mission was created
  updatedAt: null,                    // Timestamp - last modification
  dueDate: '',                      // dayjs string
  expiryDate: '',                   // should be dayjs string
  completedAt: null,                  // Timestamp | null - when completed
  lastCompletedAt: null,              // Timestamp | null - on evergreen chains, stamped on
                                      // each newly-spawned active instance with the
                                      // completedAt of the prior instance. Powers the
                                      // routine rolling-window predicate without chain walks.

  // Repetition data
  dueType: DUE_TYPES.UNIQUE,              // string - completion/due date type

  recurrence: {
  pattern: null,                // string - 'daily', 'weekly', 'monthly', 'yearly', 'custom'
  interval: 1,                  // number - every X days/weeks/months (e.g., every 2 weeks)
  weekdays: [],                 // array - [0,1,2,3,4,5,6] for weekly (0=Sunday)
  // For monthly, two modes:
  //   'dayOfMonth' (default) — uses `dayOfMonth` (1-31). The 12th of every month.
  //   'dayOfWeek' — uses `weekOfMonth` + `weekdayOfMonth`. The 2nd Tuesday of every month.
  monthlyMode: 'dayOfMonth',
  dayOfMonth: null,             // number - for monthly (1-31), used in 'dayOfMonth' mode
  weekOfMonth: null,            // number - 1|2|3|4|-1 (-1 = last), used in 'dayOfWeek' mode
  weekdayOfMonth: null,         // number - 0-6, used in 'dayOfWeek' mode
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
  // (isDailyMission is NOT stored — it's computed from dailyMissions/config
  //  via DailyMissionsContext / useIsDailyMission at display time)
  forPartyMember: null,               // object - party member
  byPartyMember: null,
  baseLocation: null,

  isPriority: false,                  // boolean - marks mission for visual emphasis + filtering

  // Tutorial linkage. Only set on missions belonging to the auto-seeded
  // "Training Grounds" tutorial quest. Identifies which tutorial script the
  // overlay system runs for this mission (e.g., 'create_first_mission').
  tutorialStep: null,                  // string | null - tutorial step key

  // Snapshotted at completion time: was this mission's chain root in any
  // active routine when it was marked completed? Lets the routine today view
  // keep showing morning completions even if the user later removes the
  // mission from the routine mid-day — mid-day rearranges shouldn't erase
  // the morning's progress.
  routineMemberAtCompletion: false,    // boolean

  // Metadata
  version: 1,                          // number - for future schema migrations
  customSortOrder: null,               // number | null - for manual drag-and-drop ordering
  scheduledDates: [],                  // string[] - future dates (YYYY-MM-DD) this mission is planned as a daily
};



// Create a new mission object with default values

export const createMissionTemplate = (overrides = {}) => {
  // XP/SP rewards are no longer stored on the mission — they're computed at
  // completion time from the mission's current difficulty + skill.
  return {
    ...MISSION_SCHEMA,
    ...overrides,
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
    if (!mission.dueDate || mission.dueDate === '') {
      errors.push('Recurring missions must have a due date');
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

