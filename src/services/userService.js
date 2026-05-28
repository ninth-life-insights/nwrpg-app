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
      weekStartDay: 1, // 0=Sun, 1=Mon, ..., 6=Sat — used for weekly review window
      recurrenceAnchorMode: 'smart', // 'smart' | 'dueDate' | 'completion'
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
      const data = docSnap.data();
      const updates = {};
      const correctedData = { ...data };

      // Recompute level/currentXP from totalXP using current formula
      if (data.totalXP != null) {
        const correctLevel = calculateLevelFromXP(data.totalXP);
        const correctProgress = getXPProgressInLevel(data.totalXP, correctLevel);
        if (data.level !== correctLevel || data.currentXP !== correctProgress.current) {
          updates.level = correctLevel;
          updates.currentXP = correctProgress.current;
          correctedData.level = correctLevel;
          correctedData.currentXP = correctProgress.current;
        }
      }

      // Recompute skill levels from totalSP using current formula
      if (data.skills) {
        const correctedSkills = { ...data.skills };
        for (const [skillName, skill] of Object.entries(data.skills)) {
          const correctLevel = getSkillLevelFromTotalSP(skill.totalSP);
          if (skill.level !== correctLevel) {
            updates[`skills.${skillName}`] = { ...skill, level: correctLevel };
            correctedSkills[skillName] = { ...skill, level: correctLevel };
          }
        }
        correctedData.skills = correctedSkills;
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
        return correctedData;
      }
      return data;
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
    xpRequired = Math.min(Math.round(xpRequired * 1.5 / 5) * 5, 1000);
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

// ─── SP / Skill helpers ───────────────────────────────────────────────────────

// SP required to reach a given skill level: 20 → 30 → 45 → 68 → 100 (cap)
export const getSPRequiredForLevel = (level) => {
  if (level <= 1) return 0;
  if (level === 2) return 20;
  if (level === 3) return 30;

  let spRequired = 30;
  for (let i = 3; i < level; i++) {
    spRequired = Math.min(Math.round(spRequired * 1.5), 100);
  }
  return spRequired;
};

// Total SP needed to reach a given skill level from scratch
export const getTotalSPForLevel = (level) => {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += getSPRequiredForLevel(i);
  }
  return total;
};

// Calculate skill level from total SP accumulated
export const getSkillLevelFromTotalSP = (totalSP) => {
  let level = 1;
  let spAccumulated = 0;

  while (spAccumulated <= totalSP) {
    level++;
    const spForNextLevel = getSPRequiredForLevel(level);
    spAccumulated += spForNextLevel;

    if (spAccumulated > totalSP) {
      return level - 1;
    }
  }

  return level;
};

// Returns progress within the current skill level
export const getSPProgressInLevel = (totalSP) => {
  const level = getSkillLevelFromTotalSP(totalSP);
  const spForPreviousLevels = getTotalSPForLevel(level);
  const current = totalSP - spForPreviousLevels;
  const required = getSPRequiredForLevel(level + 1);
  return {
    current,
    required,
    percentage: Math.round((current / required) * 100),
    level
  };
};

// Add SP to a specific skill (call when mission with skill is completed)
export const addSP = async (userId, skillName, spAmount) => {
  try {
    const userRef = doc(db, 'users', userId, 'profile', 'data');
    const profile = await getUserProfile(userId);

    if (profile) {
      const skills = profile.skills || {};
      const existing = skills[skillName] || { totalSP: 0, level: 1 };
      const newTotalSP = existing.totalSP + spAmount;
      const newLevel = getSkillLevelFromTotalSP(newTotalSP);
      const leveledUp = newLevel > existing.level;

      await updateDoc(userRef, {
        [`skills.${skillName}`]: { totalSP: newTotalSP, level: newLevel },
        lastActiveDate: serverTimestamp()
      });

      return { skillName, newLevel, newTotalSP, leveledUp };
    }
  } catch (error) {
    console.error('Error adding SP:', error);
    throw error;
  }
};

// Subtract SP from a specific skill (call when mission with skill is uncompleted)
export const subtractSP = async (userId, skillName, spAmount) => {
  try {
    const userRef = doc(db, 'users', userId, 'profile', 'data');
    const profile = await getUserProfile(userId);

    if (profile) {
      const skills = profile.skills || {};
      const existing = skills[skillName] || { totalSP: 0, level: 1 };
      const newTotalSP = Math.max(0, existing.totalSP - spAmount);
      const newLevel = getSkillLevelFromTotalSP(newTotalSP);

      await updateDoc(userRef, {
        [`skills.${skillName}`]: { totalSP: newTotalSP, level: newLevel },
        lastActiveDate: serverTimestamp()
      });

      return { skillName, newLevel, newTotalSP };
    }
  } catch (error) {
    console.error('Error subtracting SP:', error);
    throw error;
  }
};