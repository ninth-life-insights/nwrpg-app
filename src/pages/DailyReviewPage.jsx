// src/pages/DailyReviewPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../services/userService';
import {
  generateDailySnapshot,
  updateSnapshotStory,
  getEncountersForDate,
} from '../services/reviewService';
import {
  getTodaysDailyMissions,
} from '../services/dailyMissionService';
import {
  completeMissionWithRecurrence,
  uncompleteMission,
} from '../services/missionService';
import { getAchievementsAwardedOnDate } from '../services/achievementService';
import LevelUpModal from '../components/ui/LevelUpModal';
import SkillLevelUpModal from '../components/ui/SkillLevelUpModal';
import AchievementToast from '../components/achievements/AchievementToast';
import DailyMissionsStep from '../components/review/DailyMissionsStep';
import OtherMissionsStep from '../components/review/OtherMissionsStep';
import EncountersStep from '../components/review/EncountersStep';
import ReviewSummary from '../components/review/ReviewSummary';
import ErrorMessage from '../components/ui/ErrorMessage';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../utils/fetchWithTimeout';
import { toDateString } from '../utils/dateHelpers';
import './DailyReviewPage.css';

const TOTAL_STEPS = 4;

const DailyReviewPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [dailyMissions, setDailyMissions] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [levelUpInfo, setLevelUpInfo] = useState(null);
  const [skillLevelUpInfo, setSkillLevelUpInfo] = useState(null);
  const [sessionAchievements, setSessionAchievements] = useState([]);
  const [todayAchievements, setTodayAchievements] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const today = toDateString(new Date());

  // Load daily missions and any existing encounters on mount
  useEffect(() => {
    if (!currentUser) return;
    const init = async () => {
      if (isDefinitelyOffline()) {
        setLoadError("Your review didn't load. Check your connection and try again.");
        return;
      }
      try {
        const [missions, existingEncounters] = await withTimeout(
          Promise.all([
            getTodaysDailyMissions(currentUser.uid),
            getEncountersForDate(currentUser.uid, today),
          ])
        );
        setDailyMissions(missions);
        setEncounters(existingEncounters);
      } catch (err) {
        console.error('Error initializing daily review:', err);
        setLoadError(getLoadErrorMessage(err, 'review'));
      }
    };
    init();
  }, [currentUser, reloadTrigger]);

  const refreshDailyMissions = async () => {
    const missions = await getTodaysDailyMissions(currentUser.uid);
    setDailyMissions(missions);
  };

  const handleToggleComplete = async (missionId, isCurrentlyCompleted) => {
    try {
      let result;
      if (isCurrentlyCompleted) {
        result = await uncompleteMission(currentUser.uid, missionId);
      } else {
        result = await completeMissionWithRecurrence(currentUser.uid, missionId);
        if (result?.leveledUp) setLevelUpInfo({ newLevel: result.newLevel });
        if (result?.skillLeveledUp) setSkillLevelUpInfo({ skillName: result.skillName, newLevel: result.newSkillLevel });
        // Collect achievements unlocked during mission completions throughout the session
        if (result?.newlyAwardedAchievements?.length > 0) {
          setSessionAchievements(prev => [...prev, ...result.newlyAwardedAchievements]);
        }
      }
      // Refresh the daily mission list so status reflects in step 1
      await refreshDailyMissions();
      return result;
    } catch (err) {
      console.error('Error toggling mission:', err);
    }
  };

  const goToSummary = async () => {
    setStep(4);
    setSummaryLoading(true);
    setSubmitError(null);
    try {
      const [profile, earnedToday] = await withTimeout(
        Promise.all([
          getUserProfile(currentUser.uid),
          getAchievementsAwardedOnDate(currentUser.uid, today),
        ])
      );
      const displayName = profile?.displayName || 'You';
      const result = await generateDailySnapshot(currentUser.uid, today, displayName);
      // Attach encounters to snapshot for display (they're stored separately in Firestore)
      setSnapshot({ ...result, encounters });
      setTodayAchievements(earnedToday);
    } catch (err) {
      console.error('Error generating snapshot:', err);
      setSubmitError("Your review wasn't saved. Stay on this page and retry.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleNext = async () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1);
    } else {
      // Step 3 → Step 4: generate summary
      await goToSummary();
    }
  };

  const handleBack = () => {
    if (step === 1) {
      navigate('/home');
    } else {
      setStep(s => s - 1);
    }
  };

  const handleUpdateStory = async (text) => {
    await updateSnapshotStory(currentUser.uid, today, text);
    setSnapshot(prev => ({ ...prev, userEditedStory: text }));
  };

  return (
    <div className="daily-review-page">
      <header className="daily-review-header">
        <button className="daily-review-back-btn" onClick={handleBack}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="daily-review-title">Daily Review</h1>
        <div className="daily-review-header-spacer" />
      </header>

      {/* Progress bar */}
      <div className="review-progress-bar">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`review-progress-segment ${i < step ? 'review-progress-segment--filled' : ''}`}
          />
        ))}
      </div>

      <div className="daily-review-content">
        {loadError && (
          <ErrorMessage
            message={loadError}
            onRetry={() => { setLoadError(null); setReloadTrigger(t => t + 1); }}
            className="daily-review-load-error"
          />
        )}

        {!loadError && step === 1 && (
          <DailyMissionsStep
            dailyMissions={dailyMissions}
            onToggleComplete={handleToggleComplete}
            onMissionsUpdated={refreshDailyMissions}
            onNext={handleNext}
            onSkipToSummary={goToSummary}
          />
        )}

        {!loadError && step === 2 && (
          <OtherMissionsStep
            onToggleComplete={handleToggleComplete}
            onNext={handleNext}
            onBack={handleBack}
            onSkipToSummary={goToSummary}
            setLevelUpInfo={setLevelUpInfo}
            setSkillLevelUpInfo={setSkillLevelUpInfo}
            onAchievementsUnlocked={(achieved) => setSessionAchievements(prev => [...prev, ...achieved])}
          />
        )}

        {!loadError && step === 3 && (
          <EncountersStep
            userId={currentUser.uid}
            encounters={encounters}
            setEncounters={setEncounters}
            onNext={handleNext}
            onBack={handleBack}
            onSkipToSummary={goToSummary}
          />
        )}

        {!loadError && step === 4 && (
          <>
            {submitError && (
              <ErrorMessage
                message={submitError}
                onRetry={goToSummary}
                className="daily-review-submit-error"
              />
            )}
            <ReviewSummary
              snapshot={snapshot}
              loading={summaryLoading}
              onDone={() => navigate('/home')}
              onUpdateStory={handleUpdateStory}
              newAchievements={todayAchievements}
            />
          </>
        )}
      </div>

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
        achievements={sessionAchievements}
        onDismiss={() => setSessionAchievements([])}
      />
    </div>
  );
};

export default DailyReviewPage;
