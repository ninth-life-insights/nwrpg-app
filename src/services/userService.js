// services/userService.js
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/config';
import { initializeEntireBaseRoom } from './roomService';

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
    
    // Initialize the Entire Base room
    await initializeEntireBaseRoom(userId);
    
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

// Calculate XP required for a specific level
export const getXPRequiredForLevel = (level) => {
  if (level <= 1) return 0;
  if (level === 2) return 50;
  if (level === 3) return 100;
  
  // For level 4+, scale by 1.5x from previous
  let xpRequired = 100;
  for (let i = 3; i < level; i++) {
    xpRequired = Math.round(xpRequired * 1.5);
  }
  return xpRequired;
};

// Calculate total XP needed to reach a level
export const getTotalXPForLevel = (level) => {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += getXPRequiredForLevel(i);
  }
  return total;
};

// Calculate level from total XP
export const calculateLevelFromXP = (totalXP) => {
  let level = 1;
  let xpAccumulated = 0;
  
  while (xpAccumulated <= totalXP) {
    level++;
    const xpForNextLevel = getXPRequiredForLevel(level);
    xpAccumulated += xpForNextLevel;
    
    if (xpAccumulated > totalXP) {
      return level - 1;
    }
  }
  
  return level;
};

// Calculate current XP progress within current level
export const getXPProgressInLevel = (totalXP, currentLevel) => {
  const xpForPreviousLevels = getTotalXPForLevel(currentLevel);
  const currentLevelXP = totalXP - xpForPreviousLevels;
  const xpNeededForNextLevel = getXPRequiredForLevel(currentLevel + 1);
  
  return {
    current: currentLevelXP,
    required: xpNeededForNextLevel,
    percentage: Math.round((currentLevelXP / xpNeededForNextLevel) * 100)
  };
};

// Update user XP (call when mission completed)
export const addXP = async (userId, xpAmount) => {
  try {
    const userRef = doc(db, 'users', userId, 'profile', 'data');
    const profile = await getUserProfile(userId);
    
    if (profile) {
      const newTotalXP = profile.totalXP + xpAmount;
      const newLevel = calculateLevelFromXP(newTotalXP);
      const progress = getXPProgressInLevel(newTotalXP, newLevel);
      
      await updateDoc(userRef, {
        currentXP: progress.current,
        totalXP: newTotalXP,
        level: newLevel,
        lastActiveDate: serverTimestamp()
      });
      
      return { 
        newLevel, 
        newTotalXP, 
        leveledUp: newLevel > profile.level,
        progress
      };
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
      const newTotalXP = Math.max(0, profile.totalXP - xpAmount);
      const newLevel = calculateLevelFromXP(newTotalXP);
      const progress = getXPProgressInLevel(newTotalXP, newLevel);
      
      await updateDoc(userRef, {
        currentXP: progress.current,
        totalXP: newTotalXP,
        level: newLevel,
        lastActiveDate: serverTimestamp()
      });
      
      return { 
        newLevel, 
        newTotalXP, 
        leveledDown: newLevel < profile.level,
        progress
      };
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