// src/pages/HomePage.js - UPDATED FOR SIMPLIFIED DAILY MISSIONS
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { useNavigate } from 'react-router-dom';
import { 
  getTodaysDailyMissions,
  getDailyMissionStatus,
  needsToSetDailyMissions
} from '../services/dailyMissionService';
import {
  completeMissionWithRecurrence,
  uncompleteMission
} from '../services/missionService';
import { addXP, 
  subtractXP, 
  getUserProfile,  
  getXPProgressInLevel, 
  getXPRequiredForLevel  
} from '../services/userService';
import EditDailyMissionsModal from '../components/missions/EditDailyMissionsModal';
import MissionCard from '../components/missions/MissionCard';
import MissionDetailView from '../components/missions/MissionCardFull';
import './HomePage.css';

const HomePage = () => {
  const { currentUser } = useAuth();
  const [character, setCharacter] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
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
    
    // Convert class name to filename format (lowercase with hyphens)
    const classSlug = characterClass.toLowerCase().replace(/\s+/g, '-');
    
    return `/assets/Avatars/Party-Leader/small/${classSlug}-${color}-sm.png`;
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
      
      // UPDATED: Use simplified daily mission functions
      const [todaysMissions, status] = await Promise.all([
        getTodaysDailyMissions(currentUser.uid),
        getDailyMissionStatus(currentUser.uid)
      ]);

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

        // Fetch character data (for avatar/name)
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCharacter(userData.character);
        }

        // NEW: Fetch user profile (for XP/level)
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);

        // Fetch daily missions
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
  const currentLevel = userProfile?.level || 1;
  const totalXP = userProfile?.totalXP || 0;
  const progress = getXPProgressInLevel(totalXP, currentLevel);
  const progressPercentage = progress.percentage;

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
        // UPDATED: Complete with recurrence support
        const result = await completeMissionWithRecurrence(currentUser.uid, missionId);
        
        // Show level up notification if applicable
        if (result && result.leveledUp) {
          console.log(`Level up! Now level ${result.newLevel}`);
          // TODO: Show level up animation/modal
        }
      }
      
      // NEW: Refresh user profile to show updated XP/level
      const updatedProfile = await getUserProfile(currentUser.uid);
      setUserProfile(updatedProfile);
      
      // Reload missions to reflect changes
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
          <span className="material-icons">{"edit"}</span>
          Daily Planning
        </button>
        
        <button className="header-button">
          <span className="material-icons">{"check_circle"}</span>
          Daily Review
        </button>
        
        <button className="header-button settings-button">
          <span className="material-icons-outlined">{"settings"}</span>
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
                {progress.current} / {progress.required} XP
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
            <span className="material-icons">{"edit"}</span>
          </button>
        </div>
        
        {/* UPDATED: Status display */}
        {/* <div className="missions-status"> */}
          {/* <p className="status-text">{dailyStatus.statusText}</p> */}
        {/* </div> */}
        
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
               {/*
              <button 
                className="set-daily-missions-btn"
                onClick={DailyPlanningClick}
              >
                Set Daily Missions
              </button> */}
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