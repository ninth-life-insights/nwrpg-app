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
import { MISSION_STATUS } from '../types/Mission';
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
    
    // Remove id field if it exists in the data being saved
    const { id, ...dataWithoutId } = missionData;
    
    const docRef = await addDoc(missionsRef, {
      ...dataWithoutId,  // Don't include id field in the document
      status: MISSION_STATUS.ACTIVE,
      createdAt: serverTimestamp(),
      completedAt: null
    });
    
    if (!docRef.id) {
      console.error('WARNING: docRef.id is null/undefined!');
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating mission:', error);
    throw error;
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
      ...doc.data(),
      id: doc.id
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
      status: MISSION_STATUS.COMPLETED,
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
    await updateDoc(missionRef, {
      status: MISSION_STATUS.DELETED,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
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
      status: MISSION_STATUS.ACTIVE,
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
      status: MISSION_STATUS.COMPLETED,
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
      status: MISSION_STATUS.EXPIRED,
      expiredAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error expiring mission:', error);
    throw error;
  }
};
