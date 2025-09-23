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

// Form validation helpers for AddMissionCard
export const parseFormNumber = (value, defaultValue = null) => {
  if (!value || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const sanitizeFormString = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

// Daily mission helpers - moved from service for better separation
export const shouldResetDailyMissions = (lastResetDate) => {
  if (!lastResetDate) return false;
  
  const lastReset = lastResetDate.toDate ? 
    lastResetDate.toDate() : new Date(lastResetDate);
  const today = new Date();
  
  return lastReset.toDateString() !== today.toDateString();
};

export const calculateDailyMissionStats = (missions) => {
  if (!missions || missions.length === 0) {
    return { completed: 0, total: 0, percentage: 0 };
  }
  
  const completed = missions.filter(m => isMissionCompleted(m)).length;
  const total = missions.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return { completed, total, percentage };
};

export const prepareDailyMissionArchiveData = (missions) => {
  return missions.map(mission => {
    const cleaned = {};
    // Only include defined values to avoid Firestore issues
    Object.keys(mission).forEach(key => {
      if (mission[key] !== undefined) {
        cleaned[key] = mission[key];
      }
    });
    return {
      id: cleaned.id,
      title: cleaned.title,
      difficulty: cleaned.difficulty,
      xpReward: cleaned.xpReward,
      spReward: cleaned.spReward,
      skill: cleaned.skill,
      completed: isMissionCompleted(mission),
      completedAt: cleaned.completedAt
    };
  });
};

// Daily mission consistency checking - pure logic
export const detectDailyMissionInconsistencies = (configMissionIds, flaggedMissions) => {
  const configIds = new Set(configMissionIds || []);
  const flaggedIds = new Set(flaggedMissions.map(m => m.id));
  
  const issues = [];
  
  // Missions in config but not flagged
  const missingFlags = [...configIds].filter(id => !flaggedIds.has(id));
  if (missingFlags.length > 0) {
    issues.push({ type: 'missing_flags', missionIds: missingFlags });
  }
  
  // Missions flagged but not in config
  const extraFlags = [...flaggedIds].filter(id => !configIds.has(id));
  if (extraFlags.length > 0) {
    issues.push({ type: 'extra_flags', missionIds: extraFlags });
  }
  
  return {
    isConsistent: issues.length === 0,
    issues,
    configMissionIds: [...configIds],
    flaggedMissionIds: [...flaggedIds]
  };
};