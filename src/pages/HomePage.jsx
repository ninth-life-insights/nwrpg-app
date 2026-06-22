// src/pages/HomePage.js - UPDATED FOR SIMPLIFIED DAILY MISSIONS
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { initializeTutorialQuest } from '../services/tutorialService';
import { useNavigate } from 'react-router-dom';
import { 
  getTodaysDailyMissions,
  getDailyMissionStatus,
  needsToSetDailyMissions,
} from '../services/dailyMissionService';
import { uncompleteMission } from '../services/missionService';
import { useMissionCompletion } from '../contexts/MissionCompletionContext';
import { useMissions } from '../contexts/MissionsContext';
import { useQuests } from '../contexts/QuestsContext';
import {
  applyOptimisticCompletion,
  applyServerResolved,
  applyCompletionRollback,
} from '../utils/applyOptimisticCompletion';
import { addXP, 
  subtractXP, 
  getUserProfile,  
  getXPProgressInLevel, 
  getXPRequiredForLevel  
} from '../services/userService';
import { useDailyMissions } from '../contexts/DailyMissionsContext';
import EditDailyMissionsModal from '../components/missions/EditDailyMissionsModal';
import MissionCard from '../components/missions/MissionCard';
import MissionCardCondensed from '../components/missions/MissionCardCondensed.jsx';
import RoutineUpNextCard from '../components/routines/RoutineUpNextCard';
import LevelUpModal from '../components/ui/LevelUpModal';
import SkillLevelUpModal from '../components/ui/SkillLevelUpModal';
import AchievementToast from '../components/achievements/AchievementToast';
import ErrorMessage from '../components/ui/ErrorMessage';
import EmailVerificationBanner from '../components/auth/EmailVerificationBanner';
import LoadingTransition from '../components/ui/LoadingTransition';
import HomePageSkeleton from './HomePageSkeleton';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../utils/fetchWithTimeout';
import { isMissionOverdue, isMissionDueToday } from '../utils/dateHelpers';
import { getWeeklyReviewInfo } from '../utils/weeklyReviewHelpers';
import { getWeeklySnapshot } from '../services/weeklyReviewService';
import { getRoom, ENTIRE_BASE_ROOM_ID } from '../services/roomService';
import './HomePage.css';

const HomePage = () => {
  const { currentUser } = useAuth();
  const { refreshDailyMissions } = useDailyMissions();
  const { completeMission: completeMissionOptimistic } = useMissionCompletion();
  const { refreshQuests } = useQuests();
  const {
    missions: allMissions,
    isInitialLoading: missionsCacheLoading,
    refresh: refreshMissionsCache,
  } = useMissions();
  const [character, setCharacter] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [dailyMissions, setDailyMissions] = useState([]);
  const [dailyMissionStatus, setDailyMissionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditDailyMissions, setShowEditDailyMissions] = useState(false);
  const navigate = useNavigate();
  const [levelUpInfo, setLevelUpInfo] = useState(null);
  const [skillLevelUpInfo, setSkillLevelUpInfo] = useState(null);
  const [newAchievements, setNewAchievements] = useState([]);
  const [baseName, setBaseName] = useState('');
  const [baseIcon, setBaseIcon] = useState('home');
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [weeklyReviewEligible, setWeeklyReviewEligible] = useState(false);
  const [showWeeklyReviewSheet, setShowWeeklyReviewSheet] = useState(false);

  // Base stats and urgent count derive from the shared missions cache. They
  // re-compute whenever the cache changes (initial load, background refresh,
  // or any mutation via mutateMissionsCache).
  const baseStats = useMemo(() => {
    if (!allMissions) return { total: 0, dueThisWeek: 0, overdue: 0 };
    const now = new Date();
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(now.getDate() + 7);
    const roomMissions = allMissions.filter(m => m.baseLocation && m.status !== 'completed');
    let total = roomMissions.length;
    let overdue = 0;
    let dueThisWeek = 0;
    roomMissions.forEach(m => {
      if (m.dueDate) {
        const d = m.dueDate.toDate ? m.dueDate.toDate() : new Date(m.dueDate);
        if (d < now) overdue++;
        else if (d <= oneWeekFromNow) dueThisWeek++;
      }
    });
    return { total, dueThisWeek, overdue };
  }, [allMissions]);

  const urgentMissionCount = useMemo(() => {
    if (!allMissions) return 0;
    return allMissions.filter(m =>
      m.status === 'active' && (isMissionOverdue(m) || isMissionDueToday(m))
    ).length;
  }, [allMissions]);

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

      // getTodaysDailyMissions may auto-promote pre-planned history into the
      // config doc on its first call of the day. Refresh the context so the
      // daily badge appears immediately on cards rendering this load.
      refreshDailyMissions();

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
      try {
        // Missions come from the shared MissionsContext (already in flight or
        // already cached). We fetch only the page-specific data here.
        const [userDoc, profile, entireBaseRoom] = await withTimeout(
          Promise.all([
            getDoc(doc(db, 'users', currentUser.uid)),
            getUserProfile(currentUser.uid),
            getRoom(currentUser.uid, ENTIRE_BASE_ROOM_ID).catch(() => null),
          ])
        );
        if (userDoc.exists()) {
          setCharacter(userDoc.data().character);
        }
        setUserProfile(profile);
        setBaseName(profile?.baseName || '');
        if (entireBaseRoom?.icon) setBaseIcon(entireBaseRoom.icon);

        // Retry the tutorial quest seed if signup-time write failed. Only
        // fires when the flag is explicitly true, so existing accounts that
        // predate the tutorial feature are unaffected (no backfill).
        if (userDoc.exists() && userDoc.data().tutorialSeedFailed === true) {
          try {
            await initializeTutorialQuest(currentUser.uid);
            await setDoc(doc(db, 'users', currentUser.uid), {
              tutorialSeedFailed: false,
            }, { merge: true });
            // Refresh the shared caches so the freshly-seeded quest,
            // missions, and daily config become visible without a reload.
            await Promise.all([
              refreshQuests?.(),
              refreshMissionsCache?.(),
              refreshDailyMissions?.(),
            ].map(p => Promise.resolve(p).catch(() => {})));
          } catch (retryError) {
            console.error('Tutorial seed retry failed:', retryError);
            // Leave the flag set — will retry on next mount.
          }
        }

        await fetchDailyMissions();

        // Check weekly review eligibility
        try {
          const weekStartDay = profile?.weekStartDay ?? 1;
          const reviewInfo = getWeeklyReviewInfo(weekStartDay);
          if (reviewInfo.isEligible) {
            const weekStartStr = reviewInfo.reviewedWeekStart.format('YYYY-MM-DD');
            const existing = await getWeeklySnapshot(currentUser.uid, weekStartStr);
            setWeeklyReviewEligible(!existing);
          }
        } catch { /* non-fatal */ }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setDailyMissions([]);
        setLoadError(getLoadErrorMessage(error, 'missions'));
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser]);

  // SIMPLIFIED: Function to refresh daily missions after editing. Also
  // re-fetches allMissions so the routine "Next up" preview reflects the
  // latest state (a completion spawns a child instance; the previous active
  // one drops out of today's view).
  const handleDailyMissionsUpdate = async () => {
    await fetchDailyMissions();
    // The shared cache owns the all-missions refresh now.
    try {
      await refreshMissionsCache();
    } catch (err) {
      console.error('Error refreshing all missions:', err);
    }
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

  // Toggle completion. Completion is routed through MissionCompletionContext
  // for optimistic UI + double-tap guard; uncompletion stays on the original
  // (non-optimistic) path since it isn't part of the slow-tap problem.
  // Level-up + skill-up modals are now rendered globally by NotificationContext,
  // so we no longer call setLevelUpInfo/setSkillLevelUpInfo here.
  const handleToggleComplete = async (missionId, isCurrentlyCompleted, xpReward) => {
    setActionError(null);

    if (isCurrentlyCompleted) {
      try {
        await uncompleteMission(currentUser.uid, missionId);
        const updatedProfile = await getUserProfile(currentUser.uid);
        setUserProfile(updatedProfile);
        await handleDailyMissionsUpdate();
      } catch (err) {
        console.error('Error uncompleting mission:', err);
        setActionError("That undo didn't go through. Try again.");
      }
      return;
    }

    const mission = dailyMissions.find((m) => m.id === missionId);
    if (!mission) return;

    completeMissionOptimistic(missionId, mission, {
      onLocalMutation: (event) => {
        if (event.type === 'completed') {
          setDailyMissions((prev) => applyOptimisticCompletion(prev, missionId));
        } else if (event.type === 'serverResolved') {
          setDailyMissions((prev) => applyServerResolved(prev, missionId, event.result));
        } else if (event.type === 'rollback') {
          setDailyMissions((prev) => applyCompletionRollback(prev, missionId));
        }
      },
      onResolved: () => {
        // Background refresh of the user profile so the XP bar catches up.
        // Not awaited — the checkmark already flipped optimistically.
        getUserProfile(currentUser.uid)
          .then(setUserProfile)
          .catch((e) => console.error('Profile refresh after completion failed:', e));
      },
      onAchievementsResolved: (achievements) => {
        setNewAchievements(achievements);
      },
      onError: () => {
        setActionError("That mission didn't complete. Try again.");
      },
    });
  };

  return (
    <LoadingTransition loading={loading || missionsCacheLoading} skeleton={<HomePageSkeleton />}>
    <div className="homepage-container">
      {/* Header */}
      <header className="homepage-header">
        <button className="header-button" onClick={DailyPlanningClick}>
          <span className="material-icons">{"edit"}</span>
          Daily Planning
        </button>
        
        <button
          className={`header-button${weeklyReviewEligible ? ' header-button--weekly-ready' : ''}`}
          onClick={() => weeklyReviewEligible ? setShowWeeklyReviewSheet(true) : navigate('/daily-review')}
        >
          <span className="material-icons">check_circle</span>
          {weeklyReviewEligible ? 'Review' : 'Daily Review'}
          {weeklyReviewEligible && <span className="header-weekly-dot" aria-label="Weekly review ready" />}
        </button>
        
        <button className="header-button adventure-log-button" onClick={() => navigate('/adventure-log')}>
          <span className="material-icons-outlined">{"auto_stories"}</span>
        </button>

        <button className="header-button settings-button" onClick={() => navigate('/settings')}>
          <span className="material-icons-outlined">{"settings"}</span>
        </button>
      </header>

      <EmailVerificationBanner />

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
                mission={mission}
                onToggleComplete={handleToggleComplete}
                onMissionChanged={fetchDailyMissions}
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

        <RoutineUpNextCard
          missions={allMissions}
          onMissionChanged={handleDailyMissionsUpdate}
        />

        <div className="action-buttons">
          <button className="action-button primary" onClick={QuestBankClick}>
            <span className="material-icons-light">explore</span>
            Quests
          </button>
          <button className="action-button secondary" onClick={MissionBankClick}>
            <span className="material-icons-light">assignment</span>
            Mission Bank
            {urgentMissionCount > 0 && <span className="notification-dot" />}
          </button>
        </div>

        
      </section>

      <section>
        <div className="home-shortcuts">
          <div className="home-shortcut-col">
            <button className="home-shortcut-btn" onClick={() => navigate('/skills')}>
              <span className="material-icons-light">brush</span>
              Skills
            </button>
            <button className="home-shortcut-btn" onClick={() => navigate('/achievements')}>
              <span className="material-icons-light">military_tech</span>
              Achievements
            </button>
          </div>
          <button className={`home-base-widget${baseIcon.includes('.') ? ' home-base-widget--has-image' : ''}`} onClick={() => navigate('/base')}>
            {baseIcon.includes('.') && (
              <img src={`/assets/Rooms/${baseIcon}`} alt="Base" className="home-base-widget-icon-img" />
            )}
            <div className="home-base-widget-content">
              <div className="home-base-widget-header">
                {!baseIcon.includes('.') && <span className="material-icons">{baseIcon}</span>}
                <span className="home-base-widget-title">{baseName || 'Base'}</span>
              </div>
              <div className="home-base-stats">
                <div className="home-base-stat">
                  <span className="home-base-stat-number">{baseStats.total}</span>
                  <span className="home-base-stat-label">Tasks</span>
                </div>
                <div className="home-base-stat">
                  <span className="home-base-stat-number">{baseStats.dueThisWeek}</span>
                  <span className="home-base-stat-label">Week</span>
                </div>
                <div className="home-base-stat">
                  <span className={`home-base-stat-number${baseStats.overdue > 0 ? ' home-base-stat-number--late' : ''}`}>
                    {baseStats.overdue}
                  </span>
                  <span className="home-base-stat-label">Late</span>
                </div>
              </div>
            </div>
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

      {showWeeklyReviewSheet && (
        <div className="review-sheet-overlay" onClick={() => setShowWeeklyReviewSheet(false)}>
          <div className="review-sheet" onClick={e => e.stopPropagation()}>
            <h3 className="review-sheet-title">Time for your weekly review</h3>
            <p className="review-sheet-sub">Take stock of the week and plan what's ahead.</p>
            <button
              className="review-sheet-primary-btn"
              onClick={() => { setShowWeeklyReviewSheet(false); navigate('/weekly-review'); }}
            >
              Start Weekly Review
            </button>
            <button
              className="review-sheet-secondary-btn"
              onClick={() => { setShowWeeklyReviewSheet(false); navigate('/daily-review'); }}
            >
              Just do daily review →
            </button>
          </div>
        </div>
      )}
    </div>
    </LoadingTransition>
  );
};

export default HomePage;