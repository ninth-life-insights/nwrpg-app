// services/missionService.js
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  setDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase/config';
import dayjs from 'dayjs';
import { toDateString } from '../utils/dateHelpers';
import { 
  calculateNextDueDate, 
  shouldCreateNextOccurrence, 
  createNextMissionInstance,
  isRecurringMission
} from '../utils/recurrenceHelpers';

// Get user's missions collection reference
const getUserMissionsRef = (userId) => {
  return collection(db, 'users', userId, 'missions');
};

// Create a new mission
export const createMission = async (userId, missionData) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    
    const docRef = await addDoc(missionsRef, {
      ...missionData,
      status: 'active',
      createdAt: serverTimestamp(),
      completedAt: null
    });
    
    if (!docRef.id) {
      console.error('WARNING: docRef.id is null/undefined!');
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating mission:', error);
    console.error('Error details:', error.message);
    throw error; // Re-throw to let AddMissionCard handle it
  }
};

// Get active missions
export const getActiveMissions = async (userId) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    const q = query(
      missionsRef, 
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting active missions:', error);
    throw error;
  }
};

// Get completed missions
export const getCompletedMissions = async (userId) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    const q = query(
      missionsRef, 
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting completed missions:', error);
    throw error;
  }
};

// Get expired missions
export const getExpiredMissions = async (userId) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    const q = query(
      missionsRef, 
      where('status', '==', 'expired'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting expired missions:', error);
    throw error;
  }
};

// Get all missions regardless of status
export const getAllMissions = async (userId) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    const q = query(missionsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting all missions:', error);
    throw error;
  }
};

// Complete a mission
export const completeMission = async (userId, missionId) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    await updateDoc(missionRef, {
      status: 'completed',
      completedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error completing mission:', error);
    throw error;
  }
};

// Update mission
export const updateMission = async (userId, missionId, updates) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    await updateDoc(missionRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating mission:', error);
    throw error;
  }
};

// Delete mission
export const deleteMission = async (userId, missionId) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    await deleteDoc(missionRef);
  } catch (error) {
    console.error('Error deleting mission:', error);
    throw error;
  }
};

// Uncomplete a mission (revert from completed to active)
export const uncompleteMission = async (userId, missionId) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    await updateDoc(missionRef, {
      status: 'active',
      completedAt: null,
      uncompletedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error uncompleting mission:', error);
    throw error;
  }
};

// Complete a recurring mission and create next instance if needed
export const completeRecurringMission = async (userId, missionId) => {
  try {
    // First, get the mission to check if it's recurring
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    const missionSnap = await getDoc(missionRef);
    
    if (!missionSnap.exists()) {
      throw new Error('Mission not found');
    }
    
    const mission = { id: missionSnap.id, ...missionSnap.data() };
    
    // Complete the current mission
    await updateDoc(missionRef, {
      status: 'completed',
      completedAt: serverTimestamp()
    });
    
    // Check if this is a recurring mission and should create next instance
    if (isRecurringMission(mission)) {
      const currentOccurrence = mission.occurrenceNumber || 1;
      
      if (shouldCreateNextOccurrence(mission.recurrence, currentOccurrence, mission.dueDate)) {
        const nextDueDate = calculateNextDueDate(mission.dueDate, mission.recurrence);
        
        if (nextDueDate) {
          // Create the next mission instance
          const nextMissionData = createNextMissionInstance(mission, nextDueDate);
          
          // Create the new mission
          const missionsRef = getUserMissionsRef(userId);
          const newMissionRef = await addDoc(missionsRef, {
            ...nextMissionData,
            createdAt: serverTimestamp()
          });
          
          console.log(`Created next recurring mission instance: ${newMissionRef.id}`);
          
          return {
            completed: true,
            nextMissionCreated: true,
            nextMissionId: newMissionRef.id,
            nextDueDate: nextDueDate
          };
        }
      }
    }
    
    return {
      completed: true,
      nextMissionCreated: false
    };
    
  } catch (error) {
    console.error('Error completing recurring mission:', error);
    throw error;
  }
};

// Enhanced complete mission function that handles both regular and recurring missions
export const completeMissionWithRecurrence = async (userId, missionId) => {
  try {
    // Get the mission to check if it's recurring
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    const missionSnap = await getDoc(missionRef);
    
    if (!missionSnap.exists()) {
      throw new Error('Mission not found');
    }
    
    const mission = { id: missionSnap.id, ...missionSnap.data() };
    
    // If it's a recurring mission, use the recurring logic
    if (isRecurringMission(mission)) {
      return await completeRecurringMission(userId, missionId);
    } else {
      // Use the regular completion logic
      await completeMission(userId, missionId);
      return {
        completed: true,
        nextMissionCreated: false
      };
    }
  } catch (error) {
    console.error('Error completing mission with recurrence:', error);
    throw error;
  }
};

// Get all instances of a recurring mission (for tracking history)
export const getRecurringMissionInstances = async (userId, parentMissionId) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    const q = query(
      missionsRef,
      where('parentMissionId', '==', parentMissionId),
      orderBy('occurrenceNumber', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting recurring mission instances:', error);
    throw error;
  }
};

// Mark mission as expired (could be run by a scheduled function)
export const expireMission = async (userId, missionId) => {
  try {
    const missionRef = doc(db, 'users', userId, 'missions', missionId);
    await updateDoc(missionRef, {
      status: 'expired',
      expiredAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error expiring mission:', error);
    throw error;
  }
};

// Get daily missions configuration
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

// Update the setDailyMissions function to use date strings
export const setDailyMissions = async (userId, selectedMissionIds) => {
  try {
    const configRef = doc(db, 'users', userId, 'dailyMissions', 'config');
    const todayString = toDateString(new Date());
    
    // Save the daily mission configuration
    await setDoc(configRef, {
      selectedMissionIds: selectedMissionIds,
      lastResetDate: serverTimestamp(),
      dateSet: todayString, // Add this for easier date tracking
      createdAt: serverTimestamp(),
      isActive: true
    });

    // Update each selected mission to mark as daily mission
    const updatePromises = selectedMissionIds.map(async (missionId) => {
      const missionRef = doc(db, 'users', userId, 'missions', missionId);
      return updateDoc(missionRef, {
        isDailyMission: true,
        dailyMissionSetAt: serverTimestamp(),
        dailyMissionDate: todayString 
      });
    });

    await Promise.all(updatePromises);
    
    return { success: true };
  } catch (error) {
    console.error('Error setting daily missions:', error);
    throw error;
  }
};

// Update existing daily missions configuration (for EditDailyMissions)
export const updateDailyMissionsConfig = async (userId, selectedMissionIds) => {
  try {
    const configRef = doc(db, 'users', userId, 'dailyMissions', 'config');
    const todayString = toDateString(new Date());
    
    // Get current config to preserve createdAt
    const currentConfig = await getDailyMissionsConfig(userId);
    const currentMissionIds = currentConfig?.selectedMissionIds || [];
    
    // Determine which missions to add/remove flags
    const toAdd = selectedMissionIds.filter(id => !currentMissionIds.includes(id));
    const toRemove = currentMissionIds.filter(id => !selectedMissionIds.includes(id));
    
    // Update the config (preserve createdAt if it exists)
    await updateDoc(configRef, {
      selectedMissionIds: selectedMissionIds,
      lastResetDate: serverTimestamp(),
      dateSet: todayString,
      updatedAt: serverTimestamp(),
      isActive: selectedMissionIds.length > 0
    });
    
    // Add daily mission flags to new missions
    if (toAdd.length > 0) {
      const addPromises = toAdd.map(async (missionId) => {
        const missionRef = doc(db, 'users', userId, 'missions', missionId);
        return updateDoc(missionRef, {
          isDailyMission: true,
          dailyMissionSetAt: serverTimestamp(),
          dailyMissionDate: todayString 
        });
      });
      await Promise.all(addPromises);
    }
    
    // Remove daily mission flags from removed missions
    if (toRemove.length > 0) {
      await clearDailyMissionStatus(userId, toRemove);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating daily missions config:', error);
    throw error;
  }
};

// Add a single mission to daily missions (for EditDailyMissions add)
export const addMissionToDailyMissions = async (userId, missionId) => {
  try {
    const config = await getDailyMissionsConfig(userId);
    
    if (!config) {
      // If no config exists, create it with this mission
      return await setDailyMissions(userId, [missionId]);
    }
    
    const currentIds = config.selectedMissionIds || [];
    
    // Check if mission is already in daily missions
    if (currentIds.includes(missionId)) {
      return { success: true, alreadyExists: true };
    }
    
    // Add to existing list
    const updatedIds = [...currentIds, missionId];
    return await updateDailyMissionsConfig(userId, updatedIds);
    
  } catch (error) {
    console.error('Error adding mission to daily missions:', error);
    throw error;
  }
};

// Remove a single mission from daily missions (for EditDailyMissions delete)
export const removeMissionFromDailyMissions = async (userId, missionId) => {
  try {
    const config = await getDailyMissionsConfig(userId);
    
    if (!config || !config.selectedMissionIds) {
      return { success: true, notFound: true };
    }
    
    const currentIds = config.selectedMissionIds;
    const updatedIds = currentIds.filter(id => id !== missionId);
    
    // If no missions left, deactivate config
    if (updatedIds.length === 0) {
      const configRef = doc(db, 'users', userId, 'dailyMissions', 'config');
      await updateDoc(configRef, {
        selectedMissionIds: [],
        isActive: false,
        updatedAt: serverTimestamp()
      });
      
      // Clear the flag from the mission
      await clearDailyMissionStatus(userId, [missionId]);
      
      return { success: true };
    }
    
    return await updateDailyMissionsConfig(userId, updatedIds);
    
  } catch (error) {
    console.error('Error removing mission from daily missions:', error);
    throw error;
  }
};

// Clear daily mission status from missions
export const clearDailyMissionStatus = async (userId, missionIds) => {
  try {
    const updatePromises = missionIds.map(async (missionId) => {
      const missionRef = doc(db, 'users', userId, 'missions', missionId);
      return updateDoc(missionRef, {
        isDailyMission: false,
        dailyMissionSetAt: null,
        dailyMissionDate: null // Clear this too for consistency
      });
    });

    await Promise.all(updatePromises);
    return { success: true };
  } catch (error) {
    console.error('Error clearing daily mission status:', error);
    throw error;
  }
};

// Get active daily missions
export const getActiveDailyMissions = async (userId) => {
  try {
    const missionsRef = getUserMissionsRef(userId);
    const q = query(
      missionsRef, 
      where('isDailyMission', '==', true),
      where('status', '==', 'active'),
      orderBy('dailyMissionSetAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting active daily missions:', error);
    throw error;
  }
};

// Reset daily missions (call this daily via scheduled function or app logic)
export const resetDailyMissions = async (userId) => {
  try {
    // Get current daily missions
    const currentDailyMissions = await getActiveDailyMissions(userId);
    
    // Clear daily status from current missions
    if (currentDailyMissions.length > 0) {
      await clearDailyMissionStatus(userId, currentDailyMissions.map(m => m.id));
    }
    
    // Mark config as inactive until user selects new missions
    const configRef = doc(db, 'users', userId, 'dailyMissions', 'config');
    await updateDoc(configRef, {
      isActive: false,
      lastResetDate: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error resetting daily missions:', error);
    throw error;
  }
};

// Archive expired daily missions and clear current ones
export const archiveExpiredDailyMissions = async (userId) => {
  try {
    const config = await getDailyMissionsConfig(userId);
    
    if (!config || !config.isActive || !config.lastResetDate) {
      return { needsArchiving: false };
    }
    
    // Convert Firestore timestamp to dayjs and get date string
    const lastResetDate = config.lastResetDate.toDate ? 
      config.lastResetDate.toDate() : new Date(config.lastResetDate);
    const lastResetDateString = toDateString(lastResetDate);
    const todayString = toDateString(new Date());
    
    // Check if we need to archive (new day)
    const needsArchiving = dayjs(lastResetDateString).isBefore(dayjs(todayString), 'day');
    
    if (!needsArchiving) {
      return { needsArchiving: false };
    }
    
    // Get current daily missions with their completion status
    const activeMissions = await getActiveMissions(userId);
    const dailyMissionsData = activeMissions
      .filter(mission => config.selectedMissionIds.includes(mission.id))
      .map(mission => ({
        id: mission.id,
        title: mission.title,
        difficulty: mission.difficulty,
        xpReward: mission.xpReward,
        spReward: mission.spReward,
        skill: mission.skill,
        completed: mission.status === 'completed',
        completedAt: mission.completedAt
      }));
    
    // Archive the daily missions for the date they were due
    if (dailyMissionsData.length > 0) {
      await archiveDailyMissionsForDate(userId, lastResetDateString, dailyMissionsData);
    }
    
    // Clear daily mission status from current missions
    await clearDailyMissionStatus(userId, config.selectedMissionIds);
    
    // Mark config as inactive
    const configRef = doc(db, 'users', userId, 'dailyMissions', 'config');
    await updateDoc(configRef, {
      isActive: false,
      lastResetDate: serverTimestamp(),
      archivedAt: serverTimestamp()
    });
    
    return { 
      needsArchiving: true, 
      archivedDate: lastResetDateString,
      archivedMissions: dailyMissionsData.length 
    };
    
  } catch (error) {
    console.error('Error archiving expired daily missions:', error);
    throw error;
  }
};

// Archive daily missions for a specific date
// Archive daily missions for a specific date
export const archiveDailyMissionsForDate = async (userId, dateString, missionsData) => {
  try {
    // Clean the missions data to remove undefined values
    const cleanedMissions = missionsData.map(mission => {
      const cleaned = {};
      Object.keys(mission).forEach(key => {
        if (mission[key] !== undefined) {
          cleaned[key] = mission[key];
        }
      });
      return cleaned;
    });

    const archiveRef = doc(db, 'users', userId, 'dailyMissionsHistory', dateString);
    
    await setDoc(archiveRef, {
      date: dateString,
      missions: cleanedMissions,
      completedCount: cleanedMissions.filter(m => m.completed).length,
      totalCount: cleanedMissions.length,
      archivedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error archiving daily missions for date:', error);
    throw error;
  }
};

// Get daily missions history for a date range
export const getDailyMissionsHistory = async (userId, startDate, endDate) => {
  try {
    const historyRef = collection(db, 'users', userId, 'dailyMissionsHistory');
    
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
    console.error('Error getting daily missions history:', error);
    throw error;
  }
};

// Get daily missions for a specific date
export const getDailyMissionsForDate = async (userId, dateString) => {
  try {
    const archiveRef = doc(db, 'users', userId, 'dailyMissionsHistory', dateString);
    const archiveSnap = await getDoc(archiveRef);
    
    if (archiveSnap.exists()) {
      return archiveSnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting daily missions for date:', error);
    throw error;
  }
};

// Checks daily missions, including validating against both storage systems
export const checkAndHandleDailyMissionReset = async (userId) => {
  try {
    // Validate consistency first
    const validation = await validateDailyMissionConsistency(userId);
    if (!validation.isConsistent) {
      console.warn('Daily mission inconsistency detected:', validation.issues);
      // Optionally auto-fix or just log
      await syncDailyMissionFlags(userId);
    }
    
    // Then proceed with normal reset logic
    const archiveResult = await archiveExpiredDailyMissions(userId);
    
    if (archiveResult.needsArchiving) {
      console.log(`Archived daily missions for ${archiveResult.archivedDate}`);
      return {
        wasReset: true,
        archivedDate: archiveResult.archivedDate,
        archivedCount: archiveResult.archivedMissions
      };
    }
    
    return { wasReset: false };
  } catch (error) {
    console.error('Error checking and handling daily mission reset:', error);
    throw error;
  }
};

// Validate that config and mission flags are in sync
export const validateDailyMissionConsistency = async (userId) => {
  try {
    const config = await getDailyMissionsConfig(userId);
    
    if (!config || !config.isActive) {
      return { isConsistent: true, issues: [] };
    }
    
    const allMissions = await getAllMissions(userId);
    const configMissionIds = new Set(config.selectedMissionIds || []);
    const flaggedMissions = allMissions.filter(m => m.isDailyMission);
    const flaggedMissionIds = new Set(flaggedMissions.map(m => m.id));
    
    const issues = [];
    
    // Check for missions in config but not flagged
    const missingFlags = [...configMissionIds].filter(id => !flaggedMissionIds.has(id));
    if (missingFlags.length > 0) {
      issues.push({ type: 'missing_flags', missionIds: missingFlags });
    }
    
    // Check for missions flagged but not in config
    const extraFlags = [...flaggedMissionIds].filter(id => !configMissionIds.has(id));
    if (extraFlags.length > 0) {
      issues.push({ type: 'extra_flags', missionIds: extraFlags });
    }
    
    return {
      isConsistent: issues.length === 0,
      issues,
      configMissionIds: [...configMissionIds],
      flaggedMissionIds: [...flaggedMissionIds]
    };
  } catch (error) {
    console.error('Error validating daily mission consistency:', error);
    throw error;
  }
};

// Auto-fix inconsistencies (optional)
export const syncDailyMissionFlags = async (userId) => {
  try {
    const validation = await validateDailyMissionConsistency(userId);
    
    if (validation.isConsistent) {
      return { fixed: false, message: 'Already consistent' };
    }
    
    const config = await getDailyMissionsConfig(userId);
    const configMissionIds = config.selectedMissionIds || [];
    
    // Clear all daily mission flags
    const allActiveMissions = await getActiveMissions(userId);
    const flaggedMissions = allActiveMissions.filter(m => m.isDailyMission);
    if (flaggedMissions.length > 0) {
      await clearDailyMissionStatus(userId, flaggedMissions.map(m => m.id));
    }
    
    // Re-apply flags based on config
    if (configMissionIds.length > 0) {
      const updatePromises = configMissionIds.map(async (missionId) => {
        const missionRef = doc(db, 'users', userId, 'missions', missionId);
        return updateDoc(missionRef, {
          isDailyMission: true,
          dailyMissionSetAt: serverTimestamp(),
          dailyMissionDate: config.dateSet || toDateString(new Date())
        });
      });
      await Promise.all(updatePromises);
    }
    
    return { fixed: true, fixedCount: configMissionIds.length };
  } catch (error) {
    console.error('Error syncing daily mission flags:', error);
    throw error;
  }
};

// Helper function to get end of current day
const getEndOfDay = () => {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
};

// Check if daily missions need reset (call this when app loads)
export const checkDailyMissionReset = async (userId) => {
  try {
    const config = await getDailyMissionsConfig(userId);
    
    if (!config || !config.lastResetDate) {
      return { needsReset: false };
    }
    
    const lastReset = config.lastResetDate.toDate ? 
      config.lastResetDate.toDate() : new Date(config.lastResetDate);
    const today = new Date();
    
    // Check if last reset was before today
    const isNewDay = lastReset.toDateString() !== today.toDateString();
    
    return { 
      needsReset: isNewDay && config.isActive,
      config: config 
    };
  } catch (error) {
    console.error('Error checking daily mission reset:', error);
    throw error;
  }
};