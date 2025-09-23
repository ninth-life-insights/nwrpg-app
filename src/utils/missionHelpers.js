// src/utils/missionHelpers.js
import { 
  MISSION_STATUS, 
  DIFFICULTY_LEVELS, 
  COMPLETION_TYPES,
  calculateXPReward,
  calculateSPReward,
  canCompleteMission,
  isMissionExpired
} from '../types/Mission';

// Mission status helpers - handle both new and legacy data
export const getMissionStatus = (mission) => {
  // Use the status field if it exists (new format)
  if (mission.status) return mission.status;
  
  // Fall back to legacy completed boolean
  if (mission.completed === true) return MISSION_STATUS.COMPLETED;
  if (mission.completed === false) return MISSION_STATUS.ACTIVE;
  
  // Default to active
  return MISSION_STATUS.ACTIVE;
};

export const isMissionCompleted = (mission) => {
  return getMissionStatus(mission) === MISSION_STATUS.COMPLETED;
};

export const isMissionActive = (mission) => {
  return getMissionStatus(mission) === MISSION_STATUS.ACTIVE;
};

export const isMissionExpiredStatus = (mission) => {
  return getMissionStatus(mission) === MISSION_STATUS.EXPIRED;
};

// XP and rewards helpers - use your existing type functions
export const getMissionXPReward = (mission) => {
  // Use existing reward if set
  if (mission.xpReward) return mission.xpReward;
  
  // Calculate using your type function
  return calculateXPReward(mission.difficulty || DIFFICULTY_LEVELS.EASY);
};

export const getMissionSPReward = (mission) => {
  // Use existing reward if set
  if (mission.spReward) return mission.spReward;
  
  // Calculate using your type function
  return calculateSPReward(
    mission.difficulty || DIFFICULTY_LEVELS.EASY, 
    mission.skill
  );
};

// Completion helpers - use your existing type functions
export const canMissionBeCompleted = (mission) => {
  return canCompleteMission(mission);
};

export const isMissionExpiredByDate = (mission) => {
  return isMissionExpired(mission);
};

// Display helpers
export const getMissionCompletionDisplay = (mission) => {
  if (mission.completionType === COMPLETION_TYPES.TIMER) {
    const target = mission.timerDurationMinutes || 0;
    const actual = mission.actualTimeSpentMinutes || 0;
    return `${actual}/${target} minutes`;
  }
  
  if (mission.completionType === COMPLETION_TYPES.COUNT) {
    const current = mission.currentCount || 0;
    const target = mission.targetCount || 0;
    return `${current}/${target}`;
  }
  
  return null; // Simple completion type
};

export const getMissionProgressPercentage = (mission) => {
  if (mission.completionType === COMPLETION_TYPES.TIMER) {
    const target = mission.timerDurationMinutes || 1;
    const actual = mission.actualTimeSpentMinutes || 0;
    return Math.min(100, (actual / target) * 100);
  }
  
  if (mission.completionType === COMPLETION_TYPES.COUNT) {
    const target = mission.targetCount || 1;
    const current = mission.currentCount || 0;
    return Math.min(100, (current / target) * 100);
  }
  
  return isMissionCompleted(mission) ? 100 : 0;
};

// Validation helper using your existing function
export const validateMissionData = (mission) => {
  // Import and use your existing validateMission function
  const { validateMission } = require('../types/Mission');
  return validateMission(mission);
};