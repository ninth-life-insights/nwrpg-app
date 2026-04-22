// src/pages/HomePage.js - UPDATED FOR SIMPLIFIED DAILY MISSIONS
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { useNavigate } from 'react-router-dom';
import {
  getTodaysDailyMissions,
  getDailyMissionStatus,
  needsToSetDailyMissions,
} from '../services/dailyMissionService';
import { getWeeklySnapshot } from '../services/weeklyReviewService';
import { isInWeeklyReviewWindow, getWeekBounds } from '../utils/dateHelpers';
import {
  completeMissionWithRecurrence,
  uncompleteMission,
  deleteMission
} from '../services/missionService';
import { addXP, 
  subtractXP, 
  getUserProfile,  
  getXPProgressInLevel, 
  getXPRequiredForLevel  
} from '../services/userService';
import EditDailyMissionsModal from '../components/missions/EditDailyMissionsModal';
import MissionCard from '../components/missions/MissionCard';
import MissionCardCondensed from '../components/missions/MissionCardCondensed.jsx';
import MissionDetailView from '../components/missions/MissionCardFull';
import LevelUpModal from '../components/ui/LevelUpModal';
import SkillLevelUpModal from '../components/ui/SkillLevelUpModal';
import AchievementToast from '../components/achievements/AchievementToast';
import ErrorMessage from '../components/ui/ErrorMessage';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../utils/fetchWithTimeout';
import './HomePage.css';

const HomePage = () => {
  const { currentUser } = useAuth();
  const [character, setCharacter] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [dailyMissions, setDailyMissions] = useState([]);
  const [dailyMissionStatus, setDailyMissionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);
  const [showEditDailyMissions, setShowEditDailyMissions] = useState(false);
  const navigate = useNavigate();
  const [selectedMission, setSelectedMission] = useState(null);
  const [levelUpInfo, setLevelUpInfo] = useState(null);
  const [skillLevelUpInfo, setSkillLevelUpInfo] = useState(null);
  const [newAchievements, setNewAchievements] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [weeklyReviewDue, setWeeklyReviewDue] = useState(false);

  const MissionBankClick = () => {
    navigate('/mission-bank');
  };

  const QuestBankClick = () => {
    navigate('/quest-bank');
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
      if (isDefinitelyOffline()) {
        setLoadError("Your missions didn't load. Check your connection and try again.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setIsLoadingSlow(false);
      const slowTimer = setTimeout(() => setIsLoadingSlow(true), 3000);
      try {
        const [userDoc, profile] = await withTimeout(
          Promise.all([
            getDoc(doc(db, 'users', currentUser.uid)),
            getUserProfile(currentUser.uid),
          ])
        );
        if (userDoc.exists()) {
          setCharacter(userDoc.data().character);
        }
        setUserProfile(profile);
        await fetchDailyMissions();

        // Check if weekly review window is open and not yet completed
        try {
          const weekStartDay = profile?.weekStartDay ?? 'monday';
          if (isInWeeklyReviewWindow(weekStartDay)) {
            const { startDate } = getWeekBounds(weekStartDay);
            const existingSnapshot = await getWeeklySnapshot(currentUser.uid, startDate);
            setWeeklyReviewDue(!existingSnapshot);
          } else {
            setWeeklyReviewDue(false);
          }
        } catch {
          // Non-fatal — badge just won't show
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setDailyMissions([]);
        setLoadError(getLoadErrorMessage(error, 'missions'));
      } finally {
        clearTimeout(slowTimer);
        setLoading(false);
        setIsLoadingSlow(false);
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
        <div className="loading">
          Loading your adventure...
          {isLoadingSlow && <p className="loading-slow-hint">Your messenger raven is taking the scenic route...</p>}
        </div>
      </div>
    );
  }

  // SIMPLIFIED: Function to toggle completion status with XP handling
  const handleToggleComplete = async (missionId, isCurrentlyCompleted, xpReward) => {
    setActionError(null);
    try {
      if (isCurrentlyCompleted) {
        // Uncomplete the mission
        await uncompleteMission(currentUser.uid, missionId);
      } else {
        // UPDATED: Complete with recurrence support
        const result = await completeMissionWithRecurrence(currentUser.uid, missionId);

        // Show level up notification if applicable
        if (result?.leveledUp) {
          setLevelUpInfo({ newLevel: result.newLevel });
        }

        if (result?.skillLeveledUp) {
          setSkillLevelUpInfo({ skillName: result.skillName, newLevel: result.newSkillLevel });
        }

        if (result?.newlyAwardedAchievements?.length > 0) {
          setNewAchievements(result.newlyAwardedAchievements);
        }
      }
      
      // NEW: Refresh user profile to show updated XP/level
      const updatedProfile = await getUserProfile(currentUser.uid);
      setUserProfile(updatedProfile);
      
      // Reload missions to reflect changes
      await handleDailyMissionsUpdate();
      
    } catch (err) {
      console.error('Error toggling mission completion:', err);
      setActionError(isCurrentlyCompleted ? "That undo didn't go through. Try again." : "That mission didn't complete. Try again.");
    }
  };

  // Add after handleToggleComplete function (around line 164)

  const handleDeleteMission = async (missionId) => {
    setActionError(null);
    try {
      await deleteMission(currentUser.uid, missionId);
      setSelectedMission(null);
      
      // Refresh daily missions and user profile
      await fetchDailyMissions();
      const updatedProfile = await getUserProfile(currentUser.uid);
      setUserProfile(updatedProfile);
      
    } catch (error) {
      console.error('Failed to delete mission:', error);
      setActionError("That mission didn't delete. Try again.");
    }
  };

  const handleUpdateMission = async (updatedMission) => {
    // Update the mission in local state
    setDailyMissions(prevMissions =>
      prevMissions.map(m =>
        m.id === updatedMission.id ? updatedMission : m
      )
    );

    // If this is the currently selected mission, update that too
    if (selectedMission && selectedMission.id === updatedMission.id) {
      setSelectedMission(updatedMission);
    }

    // Refresh to ensure data consistency
    await fetchDailyMissions();
  };

  return (
    <div className="homepage-container">
      {/* Header */}
      <header className="homepage-header">
        <button className="header-button" onClick={DailyPlanningClick}>
          <span className="material-icons">{"edit"}</span>
          Daily Planning
        </button>
        
        {weeklyReviewDue ? (
          <div className="header-button header-split-btn">
            <button className="header-split-btn-half header-split-btn-daily" onClick={() => navigate('/daily-review')}>
              <span className="material-icons">check_circle</span>
              Daily
            </button>
            <div className="header-split-btn-divider" />
            <button className="header-split-btn-half header-split-btn-weekly" onClick={() => navigate('/weekly-review')}>
              <span className="material-icons">calendar_view_week</span>
              Weekly
            </button>
          </div>
        ) : (
          <button className="header-button" onClick={() => navigate('/daily-review')}>
            <span className="material-icons">check_circle</span>
            Daily Review
          </button>
        )}
        
        <button className="header-button adventure-log-button" onClick={() => navigate('/adventure-log')}>
          <span className="material-icons-outlined">{"auto_stories"}</span>
        </button>

        <button className="header-button settings-button" onClick={() => navigate('/settings')}>
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
        {loadError && (
          <ErrorMessage
            message={loadError}
            onRetry={() => { setLoadError(null); fetchDailyMissions(); }}
            className="homepage-load-error"
          />
        )}
        {actionError && (
          <ErrorMessage message={actionError} className="homepage-action-error" />
        )}
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
              <MissionCardCondensed
                key={mission.id}
                mission={{
                  ...mission,
                  isDailyMission: true,
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
          <button className="action-button primary" onClick={QuestBankClick}>
            <span className="material-icons-light">explore</span>
            Quests
          </button>
          <button className="action-button secondary" onClick={MissionBankClick}>
            <span className="material-icons-light">assignment</span>
            Mission Bank
          </button>
        </div>

        
      </section>

      <section>
        <div className="skills-shortcut">
          <button className="action-button skills-link" onClick={() => navigate('/skills')}>
            <span className="material-icons-light">brush</span>
            Skills
          </button>
          <button className="action-button skills-link" onClick={() => navigate('/achievements')}>
            <span className="material-icons-light">military_tech</span>
            Achievements
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
          onDeleteMission={handleDeleteMission}     
          onUpdateMission={handleUpdateMission}    
        />
      )}

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

      <AchievementToast
        achievements={newAchievements}
        onDismiss={() => setNewAchievements([])}
      />

    </div>
  );
};

export default HomePage;