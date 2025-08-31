// services/userService.js
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/config';

// Create initial user profile (call this when user signs up)
export const createUserProfile = async (userId, email) => {
  try {
    const userRef = doc(db, 'users', userId, 'profile', 'data');
    await setDoc(userRef, {
      email: email,
      displayName: email.split('@')[0], // Use email prefix as default name
      level: 1,
      currentXP: 0,
      totalXP: 0,
      streak: 0,
      lastActiveDate: serverTimestamp(),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
};

// Get user profile
export const getUserProfile = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId, 'profile', 'data');
    const docSnap = await getDoc(userRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

// Update user XP (call when mission completed)
export const addXP = async (userId, xpAmount) => {
  try {
    const userRef = doc(db, 'users', userId, 'profile', 'data');
    const profile = await getUserProfile(userId);
    
    if (profile) {
      const newCurrentXP = profile.currentXP + xpAmount;
      const newTotalXP = profile.totalXP + xpAmount;
      
      // Simple leveling system: 100 XP per level
      const newLevel = Math.floor(newTotalXP / 100) + 1;
      
      await updateDoc(userRef, {
        currentXP: newCurrentXP,
        totalXP: newTotalXP,
        level: newLevel,
        lastActiveDate: serverTimestamp()
      });
      
      return { newLevel, newTotalXP, leveledUp: newLevel > profile.level };
    }
  } catch (error) {
    console.error('Error adding XP:', error);
    throw error;
  }
};

// Subtract XP (call when mission gets uncompleted)
export const subtractXP = async (userId, xpAmount) => {
  try {
    const userRef = doc(db, 'users', userId, 'profile', 'data');
    const profile = await getUserProfile(userId);
    
    if (profile) {
      const newCurrentXP = Math.max(0, profile.currentXP - xpAmount);
      const newTotalXP = Math.max(0, profile.totalXP - xpAmount);
      
      // Recalculate level based on new total XP
      const newLevel = Math.floor(newTotalXP / 100) + 1;
      
      await updateDoc(userRef, {
        currentXP: newCurrentXP,
        totalXP: newTotalXP,
        level: newLevel,
        lastActiveDate: serverTimestamp()
      });
      
      return { newLevel, newTotalXP, leveledDown: newLevel < profile.level };
    }
  } catch (error) {
    console.error('Error subtracting XP:', error);
    throw error;
  }
};

// Update user profile
export const updateUserProfile = async (userId, updates) => {
  try {
    const userRef = doc(db, 'users', userId, 'profile', 'data');
    await updateDoc(userRef, {
      ...updates,
      lastActiveDate: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};