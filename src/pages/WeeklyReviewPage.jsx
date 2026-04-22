// src/pages/WeeklyReviewPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../services/userService';
import { generateWeeklySnapshot, updateWeeklySnapshotStory } from '../services/weeklyReviewService';
import { getWeekBounds, formatWeekRange } from '../utils/dateHelpers';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../utils/fetchWithTimeout';
import BaseCheckinStep from '../components/review/BaseCheckinStep';
import QuestProgressStep from '../components/review/QuestProgressStep';
import WeeklyPlanningStep from '../components/review/WeeklyPlanningStep';
import TaskExpirationStep from '../components/review/TaskExpirationStep';
import WeeklyReviewSummary from '../components/review/WeeklyReviewSummary';
import ErrorMessage from '../components/ui/ErrorMessage';
import '../pages/DailyReviewPage.css';
import './WeeklyReviewPage.css';

const TOTAL_STEPS = 5;

const WeeklyReviewPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [weekStartDate, setWeekStartDate] = useState(null);
  const [weekEndDate, setWeekEndDate] = useState(null);
  const [weekLabel, setWeekLabel] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Load week bounds from user's weekStartDay preference
  useEffect(() => {
    if (!currentUser) return;
    const init = async () => {
      if (isDefinitelyOffline()) {
        setLoadError("Your weekly review didn't load. Check your connection and try again.");
        return;
      }
      try {
        const profile = await withTimeout(getUserProfile(currentUser.uid));
        const weekStartDay = profile?.weekStartDay ?? 'monday';
        const { startDate, endDate } = getWeekBounds(weekStartDay);
        setWeekStartDate(startDate);
        setWeekEndDate(endDate);
        setWeekLabel(formatWeekRange(startDate, endDate));
      } catch (err) {
        setLoadError(getLoadErrorMessage(err, 'weekly review'));
      }
    };
    init();
  }, [currentUser, reloadTrigger]);

  const goToSummary = async () => {
    setStep(5);
    setSummaryLoading(true);
    setSubmitError(null);
    try {
      const profile = await getUserProfile(currentUser.uid);
      const displayName = profile?.displayName || 'You';
      const result = await withTimeout(
        generateWeeklySnapshot(currentUser.uid, weekStartDate, weekEndDate, displayName)
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
    } else {
      setStep(s => s - 1);
    }
  };

  const handleUpdateStory = async (text) => {
    await updateWeeklySnapshotStory(currentUser.uid, weekStartDate, text);
    setSnapshot(prev => ({ ...prev, userEditedStory: text }));
  };

  return (
    <div className="daily-review-page">
      <header className="daily-review-header">
        <button className="daily-review-back-btn" onClick={handleBack}>
          <span className="material-icons">arrow_back</span>
        </button>
        <div className="weekly-review-header-title">
          <h1 className="daily-review-title">Weekly Review</h1>
          {weekLabel && <span className="weekly-review-week-label">{weekLabel}</span>}
        </div>
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

        {!loadError && weekStartDate && step === 1 && (
          <BaseCheckinStep
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {!loadError && weekStartDate && step === 2 && (
          <QuestProgressStep
            weekStartDate={weekStartDate}
            weekEndDate={weekEndDate}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {!loadError && weekStartDate && step === 3 && (
          <WeeklyPlanningStep
            weekStartDate={weekStartDate}
            weekEndDate={weekEndDate}
            weekLabel={weekLabel}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {!loadError && weekStartDate && step === 4 && (
          <TaskExpirationStep
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {!loadError && step === 5 && (
          <WeeklyReviewSummary
            snapshot={snapshot}
            loading={summaryLoading}
            submitError={submitError}
            onRetrySubmit={goToSummary}
            onUpdateStory={handleUpdateStory}
            onDone={() => navigate('/home')}
          />
        )}
      </div>
    </div>
  );
};

export default WeeklyReviewPage;
