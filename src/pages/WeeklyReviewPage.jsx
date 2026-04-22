// src/pages/WeeklyReviewPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../services/userService';
import { getWeeklySnapshot, generateWeeklySnapshot, updateWeeklySnapshotStory } from '../services/weeklyReviewService';
import { getWeeklyReviewInfo } from '../utils/weeklyReviewHelpers';
import LevelUpModal from '../components/ui/LevelUpModal';
import SkillLevelUpModal from '../components/ui/SkillLevelUpModal';
import AchievementToast from '../components/achievements/AchievementToast';
import BaseCheckInStep from '../components/review/BaseCheckInStep';
import QuestGroomingStep from '../components/review/QuestGroomingStep';
import WeekPlanningStep from '../components/review/WeekPlanningStep';
import TaskArchivingStep from '../components/review/TaskArchivingStep';
import WeeklyReviewSummary from '../components/review/WeeklyReviewSummary';
import ErrorMessage from '../components/ui/ErrorMessage';
import { withTimeout } from '../utils/fetchWithTimeout';
import './WeeklyReviewPage.css';

const TOTAL_STEPS = 5;

const WeeklyReviewPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [weekInfo, setWeekInfo] = useState(null);  // { reviewedWeekStart, reviewedWeekEnd, nextWeekStart }
  const [snapshot, setSnapshot] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [levelUpInfo, setLevelUpInfo] = useState(null);
  const [skillLevelUpInfo, setSkillLevelUpInfo] = useState(null);
  const [sessionAchievements, setSessionAchievements] = useState([]);

  // On mount: determine week context and check for existing snapshot
  useEffect(() => {
    if (!currentUser) return;
    const init = async () => {
      try {
        const profile = await withTimeout(getUserProfile(currentUser.uid));
        const weekStartDay = profile?.weekStartDay ?? 1;
        const info = getWeeklyReviewInfo(weekStartDay);
        setWeekInfo(info);

        const weekStartStr = info.reviewedWeekStart.format('YYYY-MM-DD');
        const existing = await withTimeout(getWeeklySnapshot(currentUser.uid, weekStartStr));
        if (existing) {
          // Already reviewed — skip straight to summary
          setSnapshot(existing);
          setStep(TOTAL_STEPS);
        }
      } catch (err) {
        console.error('Error initializing weekly review:', err);
        setLoadError("Your weekly review didn't load. Check your connection and try again.");
      }
    };
    init();
  }, [currentUser]);

  const goToSummary = async () => {
    setStep(TOTAL_STEPS);
    setSummaryLoading(true);
    setSubmitError(null);
    try {
      const weekStartStr = weekInfo.reviewedWeekStart.format('YYYY-MM-DD');
      const weekEndStr = weekInfo.reviewedWeekEnd.format('YYYY-MM-DD');
      const profile = await getUserProfile(currentUser.uid);
      const displayName = profile?.displayName || 'You';
      const result = await withTimeout(
        generateWeeklySnapshot(currentUser.uid, weekStartStr, weekEndStr, displayName)
      );
      setSnapshot(result);
    } catch (err) {
      console.error('Error generating weekly snapshot:', err);
      setSubmitError("Your review wasn't saved. Stay on this page and retry.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleNext = async () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1);
    } else {
      // Step 4 → Step 5: generate summary
      await goToSummary();
    }
  };

  const handleBack = () => {
    if (step === 1) {
      navigate('/home');
    } else if (step === TOTAL_STEPS && snapshot) {
      // On completed summary, back goes home
      navigate('/home');
    } else {
      setStep(s => s - 1);
    }
  };

  const handleMissionComplete = (result) => {
    if (result?.leveledUp) setLevelUpInfo({ newLevel: result.newLevel });
    if (result?.skillLeveledUp) setSkillLevelUpInfo({ skillName: result.skillName, newLevel: result.newSkillLevel });
    if (result?.newlyAwardedAchievements?.length > 0) {
      setSessionAchievements(prev => [...prev, ...result.newlyAwardedAchievements]);
    }
  };

  const handleUpdateStory = async (text) => {
    const weekStartStr = weekInfo?.reviewedWeekStart.format('YYYY-MM-DD');
    await updateWeeklySnapshotStory(currentUser.uid, weekStartStr, text);
    setSnapshot(prev => ({ ...prev, userEditedStory: text }));
  };

  const handleRegenerateStory = (newStory) => {
    setSnapshot(prev => ({ ...prev, aiStory: newStory, userEditedStory: null }));
  };

  return (
    <div className="weekly-review-page">
      <header className="daily-review-header">
        <button className="daily-review-back-btn" onClick={handleBack}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="daily-review-title">Weekly Review</h1>
        <div className="daily-review-header-spacer" />
      </header>

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
            onRetry={() => { setLoadError(null); setStep(1); }}
          />
        )}

        {!loadError && step === 1 && (
          <BaseCheckInStep
            onNext={handleNext}
            onSkipToSummary={goToSummary}
          />
        )}

        {!loadError && step === 2 && (
          <QuestGroomingStep
            onMissionComplete={handleMissionComplete}
            onNext={handleNext}
            onSkipToSummary={goToSummary}
          />
        )}

        {!loadError && step === 3 && (
          <WeekPlanningStep
            weekInfo={weekInfo}
            onNext={handleNext}
            onSkipToSummary={goToSummary}
          />
        )}

        {!loadError && step === 4 && (
          <TaskArchivingStep
            onNext={handleNext}
            onSkipToSummary={goToSummary}
          />
        )}

        {!loadError && step === TOTAL_STEPS && (
          <>
            {submitError && (
              <ErrorMessage
                message={submitError}
                onRetry={goToSummary}
                className="weekly-review-submit-error"
              />
            )}
            <WeeklyReviewSummary
              snapshot={snapshot}
              loading={summaryLoading}
              onDone={() => navigate('/home')}
              onUpdateStory={handleUpdateStory}
              onRegenerateStory={handleRegenerateStory}
              userId={currentUser.uid}
              weekStart={weekInfo?.reviewedWeekStart.format('YYYY-MM-DD')}
              weekEnd={weekInfo?.reviewedWeekEnd.format('YYYY-MM-DD')}
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

export default WeeklyReviewPage;
