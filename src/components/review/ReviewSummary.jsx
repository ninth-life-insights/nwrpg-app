// src/components/review/ReviewSummary.jsx
import { useState, useEffect, useRef } from 'react';
import { generateDailySnapshot } from '../../services/reviewService';
import { getUserProfile } from '../../services/userService';

const ReviewSummary = ({
  snapshot,
  loading,
  onDone,
  onUpdateStory,
  onRegenerateStory, // optional: called with new story text after regeneration
  userId,            // required when onRegenerateStory is provided
  date,              // required when onRegenerateStory is provided
  doneLabel = 'Done',
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
          <p>Writing up your day...</p>
        </div>
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
      const newSnapshot = await generateDailySnapshot(userId, date, displayName);
      onRegenerateStory(newSnapshot.aiStory);
    } catch (err) {
      console.error('Error regenerating story:', err);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="review-step">
      <div className="review-step-body">

        {/* Stats Grid */}
        <div className="daily-review-stats">
          <div className="stat-card">
            <span className="stat-number">{snapshot.missionsCompleted}</span>
            <span className="stat-label">Missions Complete</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">+{snapshot.xpEarned}</span>
            <span className="stat-label">XP Earned</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {snapshot.dailyMissionsCompleted}/{snapshot.dailyMissionsTotal}
            </span>
            <span className="stat-label">Daily Missions</span>
          </div>
        </div>

        {/* Story */}
        {(displayStory !== null || snapshot.missionsCompleted > 0) && (
          <div className="daily-review-story">
            <div className="daily-review-story-header">
              <span className="daily-review-story-label">The Story of Today</span>
              {!isEditingStory && (
                <div className="daily-review-story-actions-row">
                  {onRegenerateStory && !snapshot.userEditedStory && (
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
                  )}
                  <button className="daily-review-story-edit-btn" onClick={handleEditStart}>
                    <span className="material-icons">edit</span>
                  </button>
                </div>
              )}
            </div>

            {showRegenerateConfirm && (
              <div className="daily-review-story-confirm">
                <p>Regenerate the AI story for this day? Your current story will be replaced.</p>
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
                  placeholder="Write your own notes or memory for today..."
                  rows={6}
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
                  {storyExpanded ? 'Show less' : 'See more'}
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
        )}

        {/* Level ups */}
        {snapshot.levelUps?.length > 0 && (
          <div className="daily-review-section daily-review-section--highlight">
            <p className="level-up-callout">
              Reached Level {snapshot.levelUps[snapshot.levelUps.length - 1].newLevel}
            </p>
          </div>
        )}

        {/* Encounters */}
        {snapshot.encounters?.length > 0 && (
          <div className="daily-review-section">
            <h3 className="daily-review-section-title">Encounters</h3>
            <div className="skills-practiced-list">
              {snapshot.encounters.map(e => (
                <div key={e.id} className="encounter-summary-row">
                  <span className="encounter-summary-title">{e.title}</span>
                  {e.notes && <span className="encounter-summary-notes">{e.notes}</span>}
                </div>
              ))}
            </div>
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

      <div className="review-step-footer">
        <button className="daily-review-done-btn" onClick={onDone}>
          {doneLabel}
        </button>
      </div>
    </div>
  );
};

export default ReviewSummary;
