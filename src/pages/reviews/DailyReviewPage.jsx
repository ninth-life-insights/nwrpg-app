// src/pages/DailyReviewPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTutorial } from '../../contexts/TutorialContext';
import { useDailyMissions } from '../../contexts/DailyMissionsContext';
import { getUserProfile } from '../../services/userService';
import {
  generateDailySnapshot,
  updateSnapshotStory,
  getEncountersForDate,
} from '../../services/reviewService';
import {
  getTodaysDailyMissions,
} from '../../services/dailyMissionService';
import { uncompleteMission } from '../../services/missionService';
import { useMissionCompletion } from '../../contexts/MissionCompletionContext';
import {
  applyOptimisticCompletion,
  applyServerResolved,
  applyCompletionRollback,
} from '../../utils/applyOptimisticCompletion';
import { getAchievementsAwardedOnDate } from '../../services/achievementService';
import AchievementToast from '../../components/achievements/AchievementToast';
import DailyMissionsStep from '../../components/review/DailyMissionsStep';
import OtherMissionsStep from '../../components/review/OtherMissionsStep';
import EncountersStep from '../../components/review/EncountersStep';
import ReviewSummary from '../../components/review/ReviewSummary';
import ErrorMessage from '../../components/ui/ErrorMessage';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
import { useAndroidBackButton } from '../../hooks/useAndroidBackButton';
import { toDateString } from '../../utils/dateHelpers';
import './DailyReviewPage.css';

const TOTAL_STEPS = 4;

const DailyReviewPage = () => {
  const { currentUser } = useAuth();
  const { triggerStep } = useTutorial();
  useEffect(() => {
    triggerStep('daily-review');
    return () => triggerStep(null);
  }, [triggerStep]);
  const { refreshDailyMissions } = useDailyMissions();
  const { completeMission: completeMissionOptimistic } = useMissionCompletion();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [dailyMissions, setDailyMissions] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [sessionAchievements, setSessionAchievements] = useState([]);
  const [todayAchievements, setTodayAchievements] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [storyStyle, setStoryStyle] = useState('balanced');

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
        // getTodaysDailyMissions may auto-promote pre-planned history to the
        // config doc; refresh the context so badges render correctly.
        refreshDailyMissions();
      } catch (err) {
        console.error('Error initializing daily review:', err);
        setLoadError(getLoadErrorMessage(err, 'review'));
      }
    };
    init();
  }, [currentUser, reloadTrigger]);

  const reloadDailyMissionsList = async () => {
    const missions = await getTodaysDailyMissions(currentUser.uid);
    setDailyMissions(missions);
  };

  // Uncompletion keeps the original (non-optimistic) reload-then-resync path —
  // it's a correction action and not part of the slow-tap problem.
  // Completion is routed through MissionCompletionContext: the card flips
  // instantly via optimistic state, and child steps get the resolved result
  // back via the returned promise so existing level-up handling still works.
  const handleToggleComplete = async (missionId, isCurrentlyCompleted) => {
    if (isCurrentlyCompleted) {
      try {
        const result = await uncompleteMission(currentUser.uid, missionId);
        await reloadDailyMissionsList();
        return result;
      } catch (err) {
        console.error('Error uncompleting mission:', err);
        return undefined;
      }
    }

    const mission = dailyMissions.find((m) => m.id === missionId);

    const result = await completeMissionOptimistic(missionId, mission, {
      onLocalMutation: (event) => {
        if (event.type === 'completed') {
          setDailyMissions((prev) => applyOptimisticCompletion(prev, missionId));
        } else if (event.type === 'serverResolved') {
          setDailyMissions((prev) => applyServerResolved(prev, missionId, event.result));
        } else if (event.type === 'rollback') {
          setDailyMissions((prev) => applyCompletionRollback(prev, missionId));
        }
      },
      onAchievementsResolved: (achievements) => {
        setSessionAchievements((prev) => [...prev, ...achievements]);
      },
    });

    return result;
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
      const style = profile?.storyStyle || 'balanced';
      setStoryStyle(style);
      const result = await generateDailySnapshot(currentUser.uid, today, displayName, { storyStyle: style });
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
  useAndroidBackButton(handleBack);

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
            onMissionsUpdated={reloadDailyMissionsList}
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
              onRegenerateStory={(newStory) => setSnapshot(prev => ({ ...prev, aiStory: newStory, aiStoryGenerated: true }))}
              userId={currentUser.uid}
              date={today}
              storyStyle={storyStyle}
              newAchievements={todayAchievements}
            />
          </>
        )}
      </div>

      {/* Level-up / skill-up modals render globally from NotificationContext
          now that completions go through MissionCompletionContext. */}
      <AchievementToast
        achievements={sessionAchievements}
        onDismiss={() => setSessionAchievements([])}
      />
    </div>
  );
};

export default DailyReviewPage;
