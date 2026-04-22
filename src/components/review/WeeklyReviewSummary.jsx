// src/components/review/WeeklyReviewSummary.jsx
import { useState, useEffect, useRef } from 'react';
import { getUserProfile } from '../../services/userService';
import { generateWeeklySnapshot } from '../../services/weeklyReviewService';
import { formatWeekLabel } from '../../utils/weeklyReviewHelpers';
import dayjs from 'dayjs';
import './WeeklyReviewSummary.css';

// ─── Per-day mini grid ────────────────────────────────────────────────────────

const DayGrid = ({ dailyBreakdown }) => {
  if (!dailyBreakdown?.length) return null;

  return (
    <div className="wrs-day-grid">
      {dailyBreakdown.map(day => {
        const label = dayjs(day.date).format('dd').charAt(0);
        const count = day.missionsCompleted;
        const active = count > 0;
        return (
          <div
            key={day.date}
            className={`wrs-day-cell ${active ? 'wrs-day-cell--active' : ''} ${day.hasDailyReview ? 'wrs-day-cell--reviewed' : ''}`}
            title={`${dayjs(day.date).format('ddd MMM D')}: ${count} mission${count !== 1 ? 's' : ''}${day.hasDailyReview ? ' · daily review done' : ''}`}
          >
            <span className="wrs-day-letter">{label}</span>
            <span className="wrs-day-count">{active ? count : '·'}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const WeeklyReviewSummary = ({
  snapshot,
  loading,
  onDone,
  onUpdateStory,
  onRegenerateStory,
  userId,
  weekStart,
  weekEnd,
}) => {
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
          <p>Writing up your week...</p>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  const displayStory = snapshot.userEditedStory ?? snapshot.aiStory ?? null;
  const daysActive = snapshot.dailyBreakdown?.filter(d => d.missionsCompleted > 0).length ?? 0;

  const weekLabel = weekStart && weekEnd
    ? formatWeekLabel(dayjs(weekStart), dayjs(weekEnd))
    : null;

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
    } catch (err) {
      console.error('Error saving story:', err);
    } finally {
      setSavingStory(false);
    }
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    setShowRegenerateConfirm(false);
    try {
      const profile = await getUserProfile(userId);
      const displayName = profile?.displayName || 'You';
      const newSnapshot = await generateWeeklySnapshot(userId, weekStart, weekEnd, displayName, { forceNewStory: true });
      onRegenerateStory?.(newSnapshot.aiStory);
    } catch (err) {
      console.error('Error regenerating weekly story:', err);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="review-step">
      <div className="review-step-body">

        {weekLabel && (
          <p className="wrs-week-label">{weekLabel}</p>
        )}

        {/* Per-day grid */}
        <DayGrid dailyBreakdown={snapshot.dailyBreakdown} />

        {/* Stats */}
        <div className="daily-review-stats wrs-stats">
          <div className="stat-card">
            <span className="stat-number">{snapshot.totalMissionsCompleted}</span>
            <span className="stat-label">Missions Done</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">+{snapshot.totalXpEarned}</span>
            <span className="stat-label">XP Earned</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{daysActive}/7</span>
            <span className="stat-label">Days Active</span>
          </div>
        </div>

        {/* Chronicle */}
        <div className="daily-review-story">
          <div className="daily-review-story-header">
            <span className="daily-review-story-label">This Week's Chronicle</span>
            {!isEditingStory && (
              <div className="daily-review-story-actions-row">
                {onRegenerateStory !== undefined && (
                  <button
                    className="daily-review-story-edit-btn"
                    onClick={() => setShowRegenerateConfirm(true)}
                    disabled={regenerating}
                    title="Regenerate chronicle"
                  >
                    <span className="material-icons">
                      {regenerating ? 'hourglass_empty' : 'refresh'}
                    </span>
                  </button>
                )}
                <button className="daily-review-story-edit-btn" onClick={handleEditStart}>
                  <span className="material-icons">edit</span>
                </button>
              </div>
            )}
          </div>

          {showRegenerateConfirm && (
            <div className="daily-review-story-confirm">
              <p>Rewrite the chronicle? This will overwrite your current entry.</p>
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
                placeholder="Write your own notes for the week..."
                rows={7}
              />
              <div className="daily-review-story-actions">
                <button
                  className="story-action-btn story-action-btn--save"
                  onClick={handleSaveStory}
                  disabled={savingStory}
                >
                  {savingStory ? 'Saving...' : 'Save'}
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
                {storyExpanded ? 'Show less' : 'Read more'}
                <span className="material-icons">
                  {storyExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </>
          ) : (
            <p className="daily-review-story-empty">
              No chronicle generated. Add your own notes above.
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

      </div>

      {onDone && (
        <div className="review-step-footer">
          <button className="daily-review-done-btn" onClick={onDone}>
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default WeeklyReviewSummary;
