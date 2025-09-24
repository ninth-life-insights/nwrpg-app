// src/services/dailyMissionService.js
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { toDateString } from '../utils/dateHelpers';
import { getActiveMissions, getCompletedMissions, completeMission } from './missionService';

// SIMPLIFIED CONFIG STRUCTURE
// users/{userId}/dailyMissions/config
// {
//   missionIds: ['id1', 'id2', 'id3'],
//   setForDate: '2025-09-23',
//   createdAt: timestamp
// }

// SIMPLIFIED HISTORY STRUCTURE  
// users/{userId}/dailyHistory/{date}
// {
//   date: '2025-09-23',
//   selectedMissionIds: ['id1', 'id2', 'id3'],
//   completed: {
//     'id1': timestamp,
//     'id2': timestamp
//   }
// }

// ============================================================================
// CORE DAILY MISSION FUNCTIONS
// ============================================================================

// Get daily mission configuration
export const getDailyMissionsConfig = async (userId) => {
  try {
    const configRef = doc(db, 'users', userId, 'dailyMissions', 'config');
    const configSnap = await getDoc(configRef);
    
    if (configSnap.exists()) {
      return configSnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting daily missions config:', error);
    throw error;
  }
};

// Set daily missions (simplified)
export const setDailyMissions = async (userId, missionIds) => {
  try {
    const today = toDateString(new Date());
    const configRef = doc(db, 'users', userId, 'dailyMissions', 'config');
    
    await setDoc(configRef, {
      missionIds: missionIds,
      setForDate: today,
      createdAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error setting daily missions:', error);
    throw error;
  }
};

// Update daily mission configuration (simplified)
export const updateDailyMissionsConfig = async (userId, missionIds) => {
  try {
    const today = toDateString(new Date());
    const configRef = doc(db, 'users', userId, 'dailyMissions', 'config');
    
    await setDoc(configRef, {
      missionIds: missionIds,
      setForDate: today,
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating daily missions config:', error);
    throw error;
  }
};

// ============================================================================
// COMPUTED DAILY MISSION STATUS HELPERS
// ============================================================================

// Check if a single mission is a daily mission (computed)
export const checkIsDailyMission = async (userId, missionId) => {
  try {
    const config = await getDailyMissionsConfig(userId);
    const today = toDateString(new Date());
    
    return config?.setForDate === today && 
           config?.missionIds?.includes(missionId);
  } catch (error) {
    console.error('Error checking daily mission status:', error);
    return false;
  }
};

// Add daily mission status to multiple missions (computed)
export const addDailyMissionStatus = async (userId, missions) => {
  try {
    const config = await getDailyMissionsConfig(userId);
    const today = toDateString(new Date());
    
    const isConfigActive = config?.setForDate === today;
    const dailyMissionIds = new Set(config?.missionIds || []);
    
    return missions.map(mission => ({
      ...mission,
      isDailyMission: isConfigActive && dailyMissionIds.has(mission.id)
    }));
  } catch (error) {
    console.error('Error adding daily mission status:', error);
    return missions.map(mission => ({ ...mission, isDailyMission: false }));
  }
};

// Get today's daily missions (computed)
export const getTodaysDailyMissions = async (userId) => {
  try {
    const config = await getDailyMissionsConfig(userId);
    const today = toDateString(new Date());
    
    if (!config || config.setForDate !== today) {
      return [];
    }
    
    // Get all missions and filter for the daily ones
    const [activeMissions, completedMissions] = await Promise.all([
      getActiveMissions(userId),
      getCompletedMissions(userId)
    ]);
    
    const allMissions = [...activeMissions, ...completedMissions];
    const dailyMissions = allMissions.filter(mission => 
      config.missionIds.includes(mission.id)
    );
    
    // Add the computed isDailyMission flag
    return dailyMissions.map(mission => ({
      ...mission,
      isDailyMission: true
    }));
  } catch (error) {
    console.error('Error getting today\'s daily missions:', error);
    throw error;
  }
};

// Check if daily missions are set for today
export const hasDailyMissionsForToday = async (userId) => {
  try {
    const config = await getDailyMissionsConfig(userId);
    const today = toDateString(new Date());
    
    return config?.setForDate === today && 
           config?.missionIds?.length > 0;
  } catch (error) {
    console.error('Error checking if daily missions exist for today:', error);
    return false;
  }
};

// ============================================================================
// DAILY MISSION COMPLETION AND HISTORY
// ============================================================================

// Complete a daily mission and save to history
export const completeDailyMission = async (userId, missionId) => {
  try {
    // Complete the actual mission
    await completeMission(userId, missionId);
    
    // Save to daily history
    const today = toDateString(new Date());
    const historyRef = doc(db, 'users', userId, 'dailyHistory', today);
    
    await setDoc(historyRef, {
      [`completed.${missionId}`]: serverTimestamp()
    }, { merge: true });
    
    return { success: true };
  } catch (error) {
    console.error('Error completing daily mission:', error);
    throw error;
  }
};

// Get daily mission statistics for today
export const getDailyMissionStats = async (userId) => {
  try {
    const dailyMissions = await getTodaysDailyMissions(userId);
    
    if (dailyMissions.length === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }
    
    const completed = dailyMissions.filter(m => 
      m.status === 'completed' || m.completed === true
    ).length;
    
    const total = dailyMissions.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  } catch (error) {
    console.error('Error getting daily mission stats:', error);
    return { completed: 0, total: 0, percentage: 0 };
  }
};

// ============================================================================
// HISTORY FUNCTIONS (SIMPLIFIED)
// ============================================================================

// Save daily mission selection to history (when they're set)
export const saveDailyMissionSelection = async (userId, missionIds) => {
  try {
    const today = toDateString(new Date());
    const historyRef = doc(db, 'users', userId, 'dailyHistory', today);
    
    await setDoc(historyRef, {
      date: today,
      selectedMissionIds: missionIds,
      setAt: serverTimestamp()
    }, { merge: true });
    
    return { success: true };
  } catch (error) {
    console.error('Error saving daily mission selection:', error);
    throw error;
  }
};

// Get daily mission history for a specific date
export const getDailyMissionsForDate = async (userId, dateString) => {
  try {
    const historyRef = doc(db, 'users', userId, 'dailyHistory', dateString);
    const historySnap = await getDoc(historyRef);
    
    if (historySnap.exists()) {
      return historySnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting daily missions for date:', error);
    throw error;
  }
};

// Get daily mission history for a date range
export const getDailyMissionHistory = async (userId, startDate, endDate) => {
  try {
    const historyRef = collection(db, 'users', userId, 'dailyHistory');
    
    let q;
    if (startDate && endDate) {
      q = query(
        historyRef,
        where('date', '>=', toDateString(startDate)),
        where('date', '<=', toDateString(endDate)),
        orderBy('date', 'desc')
      );
    } else {
      q = query(historyRef, orderBy('date', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting daily mission history:', error);
    throw error;
  }
};

// ============================================================================
// HELPER FUNCTIONS FOR INDIVIDUAL MISSION MANAGEMENT
// ============================================================================

// Add a mission to today's daily missions
export const addMissionToDailyMissions = async (userId, missionId) => {
  try {
    const config = await getDailyMissionsConfig(userId);
    const today = toDateString(new Date());
    
    // If no config or not for today, create new
    if (!config || config.setForDate !== today) {
      await setDailyMissions(userId, [missionId]);
      return { success: true, created: true };
    }
    
    // Check if already included
    if (config.missionIds.includes(missionId)) {
      return { success: true, alreadyExists: true };
    }
    
    // Add to existing
    const updatedIds = [...config.missionIds, missionId];
    await updateDailyMissionsConfig(userId, updatedIds);
    
    return { success: true, added: true };
  } catch (error) {
    console.error('Error adding mission to daily missions:', error);
    throw error;
  }
};

// Remove a mission from today's daily missions
export const removeMissionFromDailyMissions = async (userId, missionId) => {
  try {
    const config = await getDailyMissionsConfig(userId);
    const today = toDateString(new Date());
    
    if (!config || config.setForDate !== today) {
      return { success: true, notFound: true };
    }
    
    const updatedIds = config.missionIds.filter(id => id !== missionId);
    await updateDailyMissionsConfig(userId, updatedIds);
    
    return { success: true, removed: true };
  } catch (error) {
    console.error('Error removing mission from daily missions:', error);
    throw error;
  }
};

// ============================================================================
// SIMPLIFIED DATE HELPERS (NO AUTO-RESET NEEDED)
// ============================================================================

// Check if user needs to set daily missions (simple check)
export const needsToSetDailyMissions = async (userId) => {
  try {
    const hasMissions = await hasDailyMissionsForToday(userId);
    return !hasMissions;
  } catch (error) {
    console.error('Error checking if user needs to set daily missions:', error);
    return true; // Default to needs setting
  }
};

// Get status for the home page
export const getDailyMissionStatus = async (userId) => {
  try {
    const [hasMissions, stats] = await Promise.all([
      hasDailyMissionsForToday(userId),
      getDailyMissionStats(userId)
    ]);
    
    return {
      hasSetDailyMissions: hasMissions,
      ...stats
    };
  } catch (error) {
    console.error('Error getting daily mission status:', error);
    return {
      hasSetDailyMissions: false,
      completed: 0,
      total: 0,
      percentage: 0
    };
  }
};