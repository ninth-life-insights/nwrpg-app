// src/contexts/NotificationContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';
import LevelUpModal from '../components/ui/LevelUpModal';
import SkillLevelUpModal from '../components/ui/SkillLevelUpModal';

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [levelUpInfo, setLevelUpInfo] = useState(null);
  const [skillLevelUpInfo, setSkillLevelUpInfo] = useState(null);

  // Call after any mission completion to handle both notifications automatically
  const notifyMissionCompletion = useCallback((result) => {
    if (!result) return;
    if (result.leveledUp && result.newLevel) {
      setLevelUpInfo({ newLevel: result.newLevel });
    }
    if (result.skillLeveledUp && result.skillName) {
      setSkillLevelUpInfo({ skillName: result.skillName, newLevel: result.newSkillLevel });
    }
  }, []);

  // Individual notifiers if needed directly
  const notifyLevelUp = useCallback((newLevel) => {
    setLevelUpInfo({ newLevel });
  }, []);

  const notifySkillLevelUp = useCallback((skillName, newLevel) => {
    setSkillLevelUpInfo({ skillName, newLevel });
  }, []);

  return (
    <NotificationContext.Provider value={{ notifyMissionCompletion, notifyLevelUp, notifySkillLevelUp }}>
      {children}

      {levelUpInfo && (
        <LevelUpModal
          newLevel={levelUpInfo.newLevel}
          onClose={() => setLevelUpInfo(null)}
        />
      )}

      {skillLevelUpInfo && (
        <SkillLevelUpModal
          skillName={skillLevelUpInfo.skillName}
          newLevel={skillLevelUpInfo.newLevel}
          onClose={() => setSkillLevelUpInfo(null)}
        />
      )}
    </NotificationContext.Provider>
  );
};