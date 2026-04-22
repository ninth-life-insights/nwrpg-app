// src/components/review/WeeklyReviewSummary.jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserProfile } from '../../services/userService';
import { generateWeeklySnapshot } from '../../services/weeklyReviewService';
import { formatForUser } from '../../utils/dateHelpers';
import ErrorMessage from '../ui/ErrorMessage';
import StickyFooter from '../ui/StickyFooter';

const WeeklyReviewSummary = ({
  snapshot,
  loading,
  submitError,
  onRetrySubmit,
  onUpdateStory,
  onDone,
}) => {
  const { currentUser } = useAuth();

  const [storyExpanded, setStoryExpanded] = useState(false);
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState('');
  const [savingStory, setSavingStory] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isEditingStory && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditingStory]);

  if (loading) {
    return (
      <div className="review-step">
        <div className="daily-review-loading">
          <p>Writing up your week…</p>
        </div>
      </div>
    );
  }

  if (!snapshot && submitError) {
    return (
      <div className="review-step">
        <div className="review-step-body">
          <ErrorMessage
            message={submitError}
            onRetry={onRetrySubmit}
          />
        </div>
        <StickyFooter>
          <button className="review-next-btn" onClick={onRetrySubmit}>
            Try again
          </button>
        </StickyFooter>
      </div>
    );
  }

  if (!snapshot) return null;

  const displayStory = snapshot.userEditedStory ?? snapshot.aiStory ?? null;

  const handleEditStart = () => {
    setStoryDraft(displayStory || '');
    setIsEditingStory(true);
    setStoryExpanded(true);
  };

  const handleSaveStory = async () => {
    if (savingStory) return;
    setSavingStory(true);
    try {
      await onUpdateStory(storyDraft);
      setIsEditingStory(false);
    } catch {
      // non-fatal
    } finally {
      setSavingStory(false);
    }
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    setShowRegenerateConfirm(false);
    try {
      const profile = await getUserProfile(currentUser.uid);
      const displayName = profile?.displayName || 'You';
      const newSnapshot = await generateWeeklySnapshot(
        currentUser.uid,
        snapshot.weekStartDate,
        snapshot.weekEndDate,
        displayName,
        { forceNewStory: true }
      );
      await onUpdateStory(newSnapshot.aiStory);
    } catch {
      // non-fatal — user can retry manually
    } finally {
      setRegenerating(false);
    }
  };

  const bestDayLabel = snapshot.bestDay
    ? `${formatForUser(snapshot.bestDay.date)} — ${snapshot.bestDay.missionsCompleted} missions`
    : null;

  const dailyMissionRate = snapshot.dailyMissionsTotal > 0
    ? Math.round((snapshot.dailyMissionsCompleted / snapshot.dailyMissionsTotal) * 100)
    : null;

  return (
    <div className="review-step">
      <div className="review-step-body">

        {/* Stats Grid */}
        <div className="daily-review-stats">
          <div className="stat-card">
            <span className="stat-number">{snapshot.missionsCompleted}</span>
            <span className="stat-label">Missions</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">+{snapshot.xpEarned}</span>
            <span className="stat-label">XP Earned</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {snapshot.daysWithActivity ?? 0}/7
            </span>
            <span className="stat-label">Active Days</span>
          </div>
        </div>

        {/* Best day + daily mission rate */}
        {(bestDayLabel || dailyMissionRate !== null) && (
          <div className="daily-review-section">
            {bestDayLabel && (
              <div className="skill-row">
                <span className="skill-row-name">Best day</span>
                <span className="quest-row-count">{bestDayLabel}</span>
              </div>
            )}
            {dailyMissionRate !== null && (
              <div className="skill-row">
                <span className="skill-row-name">Daily mission rate</span>
                <span className="quest-row-count">{dailyMissionRate}%</span>
              </div>
            )}
          </div>
        )}

        {/* Weekly story */}
        <div className="daily-review-story">
          <div className="daily-review-story-header">
            <span className="daily-review-story-label">The Story of This Week</span>
            {!isEditingStory && (
              <div className="daily-review-story-actions-row">
                <button
                  className="daily-review-story-edit-btn"
                  onClick={() => setShowRegenerateConfirm(true)}
                  disabled={regenerating}
                  title="Regenerate story"
                >
                  <span className="material-icons">
                    {regenerating ? 'hourglass_empty' : 'refresh'}
                  </span>
                </button>
                <button className="daily-review-story-edit-btn" onClick={handleEditStart}>
                  <span className="material-icons">edit</span>
                </button>
              </div>
            )}
          </div>

          {showRegenerateConfirm && (
            <div className="daily-review-story-confirm">
              <p>Rewrite this week's story? This will overwrite the current entry.</p>
              <div className="daily-review-story-actions">
                <button
                  className="story-action-btn story-action-btn--save"
                  onClick={handleRegenerate}
                >
                  Regenerate
                </button>
                <button
                  className="story-action-btn story-action-btn--cancel"
                  onClick={() => setShowRegenerateConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isEditingStory ? (
            <div className="daily-review-story-editor">
              <textarea
                ref={textareaRef}
                className="daily-review-story-textarea"
                value={storyDraft}
                onChange={e => setStoryDraft(e.target.value)}
                placeholder="Write your own notes or reflection for this week…"
                rows={6}
              />
              <div className="daily-review-story-actions">
                <button
                  className="story-action-btn story-action-btn--save"
                  onClick={handleSaveStory}
                  disabled={savingStory}
                >
                  {savingStory ? 'Saving…' : 'Save'}
                </button>
                <button
                  className="story-action-btn story-action-btn--cancel"
                  onClick={() => setIsEditingStory(false)}
                  disabled={savingStory}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : displayStory ? (
            <>
              <div className={`daily-review-story-body ${storyExpanded ? 'daily-review-story-body--expanded' : ''}`}>
                <p>{displayStory}</p>
              </div>
              {!storyExpanded && <div className="daily-review-story-fade" />}
              <button
                className="daily-review-story-toggle"
                onClick={() => setStoryExpanded(prev => !prev)}
              >
                {storyExpanded ? 'Show less' : 'See more'}
                <span className="material-icons">
                  {storyExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </>
          ) : (
            <p className="daily-review-story-empty">
              {snapshot.missionsCompleted === 0
                ? 'No missions completed this week.'
                : 'Story generation failed. Use the edit button to write your own.'}
            </p>
          )}
        </div>

        {/* Level ups */}
        {snapshot.levelUps?.length > 0 && (
          <div className="daily-review-section daily-review-section--highlight">
            <p className="level-up-callout">
              Reached Level {snapshot.levelUps[snapshot.levelUps.length - 1].newLevel}
            </p>
          </div>
        )}

        {/* Skills */}
        {snapshot.skillsUsed?.length > 0 && (
          <div className="daily-review-section">
            <h3 className="daily-review-section-title">Skills Practiced</h3>
            <div className="skills-practiced-list">
              {snapshot.skillsUsed.map(skill => (
                <div key={skill.name} className="skill-row">
                  <span className="skill-row-name">{skill.name}</span>
                  <span className="skill-row-sp">+{skill.spEarned} SP</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quests */}
        {snapshot.questsAdvanced?.length > 0 && (
          <div className="daily-review-section">
            <h3 className="daily-review-section-title">Quests Advanced</h3>
            <div className="quests-list">
              {snapshot.questsAdvanced.map(quest => (
                <div key={quest.questId} className="quest-row">
                  <span className="quest-row-title">{quest.questTitle}</span>
                  <span className="quest-row-count">
                    {quest.missionsCompleted} mission{quest.missionsCompleted !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {submitError && (
          <ErrorMessage message={submitError} onRetry={onRetrySubmit} />
        )}
      </div>

      <StickyFooter>
        <button className="daily-review-done-btn" onClick={onDone}>
          Done
        </button>
      </StickyFooter>
    </div>
  );
};

export default WeeklyReviewSummary;
