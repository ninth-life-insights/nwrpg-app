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

// Get user's missions collection reference
const getUserMissionsRef = (userId) => {
  return collection(db, 'users', userId, 'missions');
};

// Create a new mission
export const createMission = async (userId, missionData) => {
  try {
    console.log('createMission called with:', { userId, missionData });
    const missionsRef = getUserMissionsRef(userId);
    console.log('Got missions ref:', missionsRef);
    
    const docRef = await addDoc(missionsRef, {
      ...missionData,
      status: 'active',
      createdAt: serverTimestamp(),
      completedAt: null
    });
    
    console.log('addDoc completed, docRef:', docRef);
    console.log('docRef.id:', docRef.id);
    
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

// Set daily missions (save the selected 3 missions)
export const setDailyMissions = async (userId, selectedMissionIds) => {
  try {
    const configRef = doc(db, 'users', userId, 'dailyMissions', 'config');
    
    // Save the daily mission configuration
    await setDoc(configRef, {
      selectedMissionIds: selectedMissionIds,
      lastResetDate: serverTimestamp(),
      createdAt: serverTimestamp(),
      isActive: true
    });

    // Update each selected mission to mark as daily mission
    const updatePromises = selectedMissionIds.map(async (missionId) => {
      const missionRef = doc(db, 'users', userId, 'missions', missionId);
      return updateDoc(missionRef, {
        isDailyMission: true,
        dailyMissionSetAt: serverTimestamp(),
        // Set expiry to end of day (you can adjust this logic)
        expiryDate: getEndOfDay()
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