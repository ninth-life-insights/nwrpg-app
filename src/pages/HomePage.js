// src/pages/HomePage.js - UPDATED FOR SIMPLIFIED DAILY MISSIONS
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { useNavigate } from 'react-router-dom';

// UPDATED: Import simplified daily mission services
import { 
  getTodaysDailyMissions,
  getDailyMissionStatus,
  needsToSetDailyMissions
} from '../services/dailyMissionService';

// Keep regular mission services for completion
import {
  completeMission,
  uncompleteMission
} from '../services/missionService';

import { addXP, subtractXP } from '../services/userService';
import EditDailyMissionsModal from '../components/missions/EditDailyMissionsModal';
import MissionCard from '../components/missions/MissionCard';
import MissionDetailView from '../components/missions/MissionCardFull';
import './HomePage.css';

const HomePage = () => {
  const { currentUser } = useAuth();
  const [character, setCharacter] = useState(null);
  const [dailyMissions, setDailyMissions] = useState([]);
  const [dailyMissionStatus, setDailyMissionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditDailyMissions, setShowEditDailyMissions] = useState(false);
  const navigate = useNavigate();
  const [selectedMission, setSelectedMission] = useState(null);

  const MissionBankClick = () => {
    navigate('/mission-bank');
  };

  const DailyPlanningClick = () => {
    navigate('/edit-daily-missions');
  };

  // Color mapping from character creation
  const colorMap = {
    blue: '#3b82f6',
    green: '#10b981', 
    purple: '#8b5cf6',
    pink: '#ec4899',
    red: '#ef4444'
  };

  // Helper function to get avatar image path
  const getAvatarImage = (characterClass, color) => {
    if (!characterClass || !color) return null;
    
    // Convert class name to filename format
    const classMap = {
      'Knight': 'knight',
      'Sorceress': 'sorceress', 
      'Storm Tamer': 'storm-tamer',
      "l'Artiste": 'artiste'
    };
    
    const className = classMap[characterClass] || 'knight';
    return `/assets/Avatars/Party-Leader/Sorceress/char-preview/${className}-${color}.png`;
  };

  // Check if image exists (for fallback handling)
  const [imageError, setImageError] = useState({});
  
  const handleImageError = (characterClass, color) => {
    const key = `${characterClass}-${color}`;
    setImageError(prev => ({ ...prev, [key]: true }));
  };

  // SIMPLIFIED: Fetch daily missions using new system
  const fetchDailyMissions = async () => {
    if (!currentUser) return;

    try {
      console.log('Fetching daily missions...'); // DEBUG
      
      // UPDATED: Use simplified daily mission functions
      const [todaysMissions, status] = await Promise.all([
        getTodaysDailyMissions(currentUser.uid),
        getDailyMissionStatus(currentUser.uid)
      ]);

      console.log('Todays missions:', todaysMissions); // DEBUG
      console.log('Daily mission status:', status); // DEBUG

      setDailyMissions(todaysMissions);
      setDailyMissionStatus(status);

    } catch (error) {
      console.error('Error fetching daily missions:', error);
      setDailyMissions([]);
      setDailyMissionStatus({
        hasSetDailyMissions: false,
        completed: 0,
        total: 0,
        percentage: 0
      });
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;
      
      try {
        setLoading(true);

        // SIMPLIFIED: No reset logic needed - handled automatically by date checking
        console.log('Loading user data...'); // DEBUG

        // Fetch character data
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCharacter(userData.character);
        }

        // UPDATED: Fetch daily missions using simplified system
        await fetchDailyMissions();
        
      } catch (error) {
        console.error('Error fetching user data:', error);
        setDailyMissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser]);

  // SIMPLIFIED: Function to refresh daily missions after editing
  const handleDailyMissionsUpdate = async () => {
    await fetchDailyMissions();
  };

  // REMOVED: Complex reset logic - no longer needed

  // Calculate current XP and level progress
  const getXPForLevel = (level) => level * 100; // Simple formula
  const currentXP = character?.experience || 0;
  const currentLevel = character?.level || 1;
  const xpForCurrentLevel = getXPForLevel(currentLevel - 1);
  const xpForNextLevel = getXPForLevel(currentLevel);
  const progressXP = currentXP - xpForCurrentLevel;
  const requiredXP = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = (progressXP / requiredXP) * 100;

  // SIMPLIFIED: Get daily missions status for display
  const getDailyMissionsDisplayInfo = () => {
    if (!dailyMissionStatus || !dailyMissionStatus.hasSetDailyMissions) {
      return { 
        hasActiveDailyMissions: false, 
        completedCount: 0, 
        totalCount: 0,
        statusText: 'No daily missions set for today'
      };
    }

    return {
      hasActiveDailyMissions: true,
      completedCount: dailyMissionStatus.completed,
      totalCount: dailyMissionStatus.total,
      statusText: dailyMissionStatus.completed === dailyMissionStatus.total 
        ? 'All daily missions completed! 🎉'
        : `${dailyMissionStatus.completed}/${dailyMissionStatus.total} completed`
    };
  };

  const dailyStatus = getDailyMissionsDisplayInfo();

  if (loading) {
    return (
      <div className="homepage-container">
        <div className="loading">Loading your adventure...</div>
      </div>
    );
  }

  // SIMPLIFIED: Function to toggle completion status with XP handling
  const handleToggleComplete = async (missionId, isCurrentlyCompleted, xpReward) => {
    try {
      if (isCurrentlyCompleted) {
        // Uncomplete the mission
        await uncompleteMission(currentUser.uid, missionId);
        if (xpReward) {
          await subtractXP(currentUser.uid, xpReward);
        }
      } else {
        // Complete the mission
        await completeMission(currentUser.uid, missionId);
        if (xpReward) {
          const result = await addXP(currentUser.uid, xpReward);
          
          // Show level up notification if applicable
          if (result && result.leveledUp) {
            console.log(`Level up! Now level ${result.newLevel}`);
          }
        }
      }
      
      // UPDATED: Reload missions to reflect changes
      await handleDailyMissionsUpdate();
      
    } catch (err) {
      console.error('Error toggling mission completion:', err);
    }
  };

  return (
    <div className="homepage-container">
      {/* Header */}
      <header className="homepage-header">
        <button className="header-button" onClick={DailyPlanningClick}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Daily Planning
        </button>
        
        <button className="header-button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9,11 12,14 22,4"/>
            <path d="M21,12v7a2,2 0,0 1,-2,2H5a2,2 0,0 1,-2,-2V5a2,2 0,0 1,2,-2h11"/>
          </svg>
          Daily Review
        </button>
        
        <button className="header-button settings-button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4,15a1.65,1.65 0,0 0,.33,1.82l.06.06a2,2 0,0 1,0,2.83 2,2 0,0 1,-2.83,0l-.06-.06a1.65,1.65 0,0 0,-1.82-.33 1.65,1.65 0,0 0,-1,1.51V21a2,2 0,0 1,-2,2 2,2 0,0 1,-2,-2v-.09A1.65,1.65 0,0 0,9,19.4a1.65,1.65 0,0 0,-1.82.33l-.06.06a2,2 0,0 1,-2.83,0 2,2 0,0 1,0,-2.83l.06-.06a1.65,1.65 0,0 0,.33,-1.82 1.65,1.65 0,0 0,-1.51,-1H3a2,2 0,0 1,-2,-2 2,2 0,0 1,2,-2h.09A1.65,1.65 0,0 0,4.6,9a1.65,1.65 0,0 0-.33,-1.82L4.21,7.11a2,2 0,0 1,0,-2.83 2,2 0,0 1,2.83,0l.06.06a1.65,1.65 0,0 0,1.82.33H9a1.65,1.65 0,0 0,1,1.51V3a2,2 0,0 1,2,-2 2,2 0,0 1,2,2v.09a1.65,1.65 0,0 0,1,1.51 1.65,1.65 0,0 0,1.82-.33l.06-.06a2,2 0,0 1,2.83,0 2,2 0,0 1,0,2.83l-.06.06a1.65,1.65 0,0 0-.33,1.82V9a1.65,1.65 0,0 0,1.51,1H21a2,2 0,0 1,2,2 2,2 0,0 1,-2,2h-.09a1.65,1.65 0,0 0,-1.51,1z"/>
          </svg>
        </button>
      </header>

      {/* Profile Section */}
      <section className="profile-section">
        <div className="profile-content">
          <div className="avatar-container">
            {(() => {
              const avatarImage = getAvatarImage(character?.class, character?.color);
              const imageKey = `${character?.class}-${character?.color}`;
              const hasImageError = imageError[imageKey];
              
              if (avatarImage && !hasImageError) {
                return (
                  <img 
                    src={avatarImage}
                    alt={`${character?.class} avatar`}
                    className="character-avatar-image"
                    onError={() => handleImageError(character?.class, character?.color)}
                  />
                );
              } else {
                // Fallback to colored background with class name
                return (
                  <div 
                    className="character-avatar" 
                    style={{ 
                      backgroundColor: character?.color ? colorMap[character.color] : colorMap.blue
                    }}
                  >
                    <span className="avatar-class">{character?.class || 'Adventurer'}</span>
                  </div>
                );
              }
            })()}
          </div>
          
          <div className="profile-info">
            <h2 className="character-name">{character?.name || 'Adventurer'}</h2>
            <p className="character-title">"{character?.title || 'Getting Started'}"</p>
            <div className="level-info">
              <span className="current-level">Level {currentLevel}</span>
            </div>
            <div className="xp-section">
              <div className="xp-bar">
                <div 
                  className="xp-progress" 
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <div className="xp-counter">
                {progressXP} / {requiredXP} XP
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Missions Section */}
      <section className="daily-missions-section">
        <div className="section-header">
          <h3 className="section-title">
            Daily Missions
          </h3>
          <button className="edit-button" onClick={() => setShowEditDailyMissions(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
        
        {/* UPDATED: Status display */}
        <div className="missions-status">
          <p className="status-text">{dailyStatus.statusText}</p>
        </div>
        
        <div className="missions-overview">
          {dailyStatus.hasActiveDailyMissions ? (
            dailyMissions.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={{
                  ...mission,
                  isDailyMission: true // All missions here are daily missions
                }}
                onToggleComplete={handleToggleComplete}
                onViewDetails={setSelectedMission}
              />
            ))
          ) : (
            <div className="no-missions">
              <p>No daily missions set for today.</p>
              <button 
                className="set-daily-missions-btn"
                onClick={DailyPlanningClick}
              >
                Set Daily Missions
              </button>
            </div>
          )}
        </div>

        <div className="action-buttons">
          <button className="action-button primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Quests
          </button>
          <button className="action-button secondary" onClick={MissionBankClick}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M7 15h0M12 15h0M17 15h0"/>
            </svg>
            Mission Bank
          </button>
        </div>
      </section>

      {showEditDailyMissions && (
        <EditDailyMissionsModal 
          currentDailyMissions={dailyMissions}
          onClose={() => setShowEditDailyMissions(false)}
          onSave={handleDailyMissionsUpdate}
        />
      )}

      {selectedMission && (
        <MissionDetailView 
          mission={selectedMission} 
          onClose={() => setSelectedMission(null)} 
          onToggleComplete={handleToggleComplete} 
        />
      )}
    </div>
  );
};

export default HomePage;