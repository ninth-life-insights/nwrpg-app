// src/types/Mission.js

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
  skill: null,                        // string | null - associated skill
  spReward: null,
  
  // Timestamps (Firestore Timestamp objects)
  createdAt: null,                    // Timestamp - when mission was created
  updatedAt: null,                    // Timestamp - last modification
  dueDate: '',                      // Timestamp | null - optional due date
  expiryDate: null,                   // Timestamp | null - optional expiry
  completedAt: null,                  // Timestamp | null - when completed

  // Repetition data
  dueType: DUE_TYPES.UNIQUE,              // string - completion/due date type

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


// validate mission data structure
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
  
  return {
    isValid: errors.length === 0,
    errors
  };
};


// Helper function to safely extract Date from Firestore timestamp or regular date
 const extractDate = (dateInput) => {
  return dateInput && dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
};

// check if mission is overdue
// export const isMissionOverdue = (mission) => {
//   if (!mission.dueDate || mission.status === MISSION_STATUS.COMPLETED) {
//     console.log(mission.title);
//     console.log('mission due Date:');
//     console.log(mission.dueDate);
//     console.log('mission status:');
//     console.log(mission.status);
//     return false;
//   }
  
//   const now = new Date();
//   const dueDate = extractDate(mission.dueDate);
//   // Compare current time with end of due date
//   const endOfDueDate = normalizeToEndOfDay(dueDate);
//   console.log(mission.title);
//   console.log('now:');
//   console.log(now);
//   console.log('dueDate:');
//   console.log(dueDate);
//   console.log('endofDueDate:');
//   console.log(endOfDueDate);
  
//   return now > endOfDueDate;
// };

// // check if mission is due today
// export const isMissionDueToday = (mission) => {
//   if (!mission.dueDate || mission.status === MISSION_STATUS.COMPLETED) {
    
//     return false;
//   }
  
//   const today = normalizeToStartOfDay(new Date());
//   const dueDate = normalizeToStartOfDay(extractDate(mission.dueDate));
  
//   return +today === +dueDate;
// };

// // check if mission is due tomorrow
// export const isMissionDueTomorrow = (mission) => {
//   if (!mission.dueDate || mission.status === MISSION_STATUS.COMPLETED) {
//     return false;
//   }
  
//   const today = new Date();
//   const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0, 0);
  
//   const dueDate = normalizeToStartOfDay(extractDate(mission.dueDate));
  
//   return +tomorrow === +dueDate;
// };

// get days until mission is due
// export const getDaysUntilDue = (mission) => {
//   if (!mission.dueDate) {
//     return null;
//   }
  
//   const today = normalizeToStartOfDay(new Date());
//   const dueDate = normalizeToStartOfDay(extractDate(mission.dueDate));
  
//   const diffTime = dueDate.getTime() - today.getTime();
//   return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
// };

// check if mission is expired
export const isMissionExpired = (mission) => {
  if (!mission.expiryDate) {
    return false;
  }
  
  const now = new Date();
  const expiryDate = extractDate(mission.expiryDate);
  
  return now > expiryDate;
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