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
        dailyMissionDate: todayString // Add this for tracking
      });
    });

    await Promise.all(updatePromises);
    
    return { success: true };
  } catch (error) {
    console.error('Error setting daily missions:', error);
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
        expiryDate: null
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
export const archiveDailyMissionsForDate = async (userId, dateString, missionsData) => {
  try {
    const archiveRef = doc(db, 'users', userId, 'dailyMissionsHistory', dateString);
    
    await setDoc(archiveRef, {
      date: dateString,
      missions: missionsData,
      completedCount: missionsData.filter(m => m.completed).length,
      totalCount: missionsData.length,
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

// Updated check function that uses the new date system
export const checkAndHandleDailyMissionReset = async (userId) => {
  try {
    // First check if we need to archive expired missions
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