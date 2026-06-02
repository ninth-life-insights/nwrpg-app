// src/pages/HomePageSandbox.jsx
// Temporary sandbox for visual-language iteration. Verbatim duplicate of
// HomePage; styles are scoped under .home-sandbox-page so changes don't
// leak into production. Remove when changes promote to HomePage.
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { useNavigate } from 'react-router-dom';
import {
  getTodaysDailyMissions,
  getDailyMissionStatus,
} from '../services/dailyMissionService';
import {
  completeMissionWithRecurrence,
  uncompleteMission,
  getAllMissions,
} from '../services/missionService';
import {
  getUserProfile,
  getXPProgressInLevel,
} from '../services/userService';
import { useDailyMissions } from '../contexts/DailyMissionsContext';
import EditDailyMissionsModal from '../components/missions/EditDailyMissionsModal';
import MissionCardCondensed from '../components/missions/MissionCardCondensed.jsx';
import RoutineUpNextCard from '../components/routines/RoutineUpNextCard';
import LevelUpModal from '../components/ui/LevelUpModal';
import SkillLevelUpModal from '../components/ui/SkillLevelUpModal';
import AchievementToast from '../components/achievements/AchievementToast';
import ErrorMessage from '../components/ui/ErrorMessage';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../utils/fetchWithTimeout';
import { isMissionOverdue, isMissionDueToday } from '../utils/dateHelpers';
import { getWeeklyReviewInfo } from '../utils/weeklyReviewHelpers';
import { getWeeklySnapshot } from '../services/weeklyReviewService';
import { getRoom, ENTIRE_BASE_ROOM_ID } from '../services/roomService';
import './HomePageSandbox.css';

const HomePageSandbox = () => {
  const { currentUser } = useAuth();
  const { refreshDailyMissions } = useDailyMissions();
  const [character, setCharacter] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [dailyMissions, setDailyMissions] = useState([]);
  const [dailyMissionStatus, setDailyMissionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);
  const [showEditDailyMissions, setShowEditDailyMissions] = useState(false);
  const navigate = useNavigate();
  const [levelUpInfo, setLevelUpInfo] = useState(null);
  const [skillLevelUpInfo, setSkillLevelUpInfo] = useState(null);
  const [newAchievements, setNewAchievements] = useState([]);
  const [baseStats, setBaseStats] = useState({ total: 0, dueThisWeek: 0, overdue: 0 });
  const [urgentMissionCount, setUrgentMissionCount] = useState(0);
  const [baseName, setBaseName] = useState('');
  const [baseIcon, setBaseIcon] = useState('home');
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [weeklyReviewEligible, setWeeklyReviewEligible] = useState(false);
  const [showWeeklyReviewSheet, setShowWeeklyReviewSheet] = useState(false);
  const [allMissions, setAllMissions] = useState(null);

  const MissionBankClick = () => {
    navigate('/mission-bank');
  };

  const QuestBankClick = () => {
    navigate('/quest-bank');
  };

  const DailyPlanningClick = () => {
    navigate('/edit-daily-missions');
  };

  const colorMap = {
    blue: '#3b82f6',
    green: '#10b981',
    purple: '#8b5cf6',
    pink: '#ec4899',
    red: '#ef4444'
  };

  const getAvatarImage = (characterClass, color) => {
    if (!characterClass || !color) return null;
    const classSlug = characterClass.toLowerCase().replace(/\s+/g, '-');
    return `/assets/Avatars/Party-Leader/small/${classSlug}-${color}-sm.png`;
  };

  const [imageError, setImageError] = useState({});

  const handleImageError = (characterClass, color) => {
    const key = `${characterClass}-${color}`;
    setImageError(prev => ({ ...prev, [key]: true }));
  };

  const fetchDailyMissions = async () => {
    if (!currentUser) return;

    try {
      const [todaysMissions, status] = await Promise.all([
        getTodaysDailyMissions(currentUser.uid),
        getDailyMissionStatus(currentUser.uid)
      ]);

      setDailyMissions(todaysMissions);
      setDailyMissionStatus(status);
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
      setIsLoadingSlow(false);
      const slowTimer = setTimeout(() => setIsLoadingSlow(true), 3000);
      try {
        const [userDoc, profile, allMissions, entireBaseRoom] = await withTimeout(
          Promise.all([
            getDoc(doc(db, 'users', currentUser.uid)),
            getUserProfile(currentUser.uid),
            getAllMissions(currentUser.uid),
            getRoom(currentUser.uid, ENTIRE_BASE_ROOM_ID).catch(() => null),
          ])
        );
        if (userDoc.exists()) {
          setCharacter(userDoc.data().character);
        }
        setUserProfile(profile);
        setAllMissions(allMissions);
        setBaseName(profile?.baseName || '');
        if (entireBaseRoom?.icon) setBaseIcon(entireBaseRoom.icon);

        const now = new Date();
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(now.getDate() + 7);
        const roomMissions = allMissions.filter(m => m.baseLocation && m.status !== 'completed');
        let bTotal = roomMissions.length, bOverdue = 0, bDueThisWeek = 0;
        roomMissions.forEach(m => {
          if (m.dueDate) {
            const d = m.dueDate.toDate ? m.dueDate.toDate() : new Date(m.dueDate);
            if (d < now) bOverdue++;
            else if (d <= oneWeekFromNow) bDueThisWeek++;
          }
        });
        setBaseStats({ total: bTotal, dueThisWeek: bDueThisWeek, overdue: bOverdue });

        const urgent = allMissions.filter(m =>
          m.status === 'active' && (isMissionOverdue(m) || isMissionDueToday(m))
        ).length;
        setUrgentMissionCount(urgent);

        await fetchDailyMissions();

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
        clearTimeout(slowTimer);
        setLoading(false);
        setIsLoadingSlow(false);
      }
    };

    fetchUserData();
  }, [currentUser]);

  const handleDailyMissionsUpdate = async () => {
    await fetchDailyMissions();
    try {
      const refreshed = await getAllMissions(currentUser.uid);
      setAllMissions(refreshed);
    } catch (err) {
      console.error('Error refreshing all missions:', err);
    }
  };

  const currentLevel = userProfile?.level || 1;
  const totalXP = userProfile?.totalXP || 0;
  const progress = getXPProgressInLevel(totalXP, currentLevel);
  const progressPercentage = progress.percentage;

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
      <div className="home-sandbox-page">
        <div className="loading">
          Loading your adventure...
          {isLoadingSlow && <p className="loading-slow-hint">Your messenger raven is taking the scenic route...</p>}
        </div>
      </div>
    );
  }

  const handleToggleComplete = async (missionId, isCurrentlyCompleted, xpReward) => {
    setActionError(null);
    try {
      if (isCurrentlyCompleted) {
        await uncompleteMission(currentUser.uid, missionId);
      } else {
        const result = await completeMissionWithRecurrence(currentUser.uid, missionId);

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

      const updatedProfile = await getUserProfile(currentUser.uid);
      setUserProfile(updatedProfile);

      await handleDailyMissionsUpdate();

    } catch (err) {
      console.error('Error toggling mission completion:', err);
      setActionError(isCurrentlyCompleted ? "That undo didn't go through. Try again." : "That mission didn't complete. Try again.");
    }
  };

  return (
    <div className="home-sandbox-page">
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
  );
};

export default HomePageSandbox;
