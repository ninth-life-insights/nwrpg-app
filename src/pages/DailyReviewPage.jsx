// src/pages/DailyReviewPage.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../services/userService';
import {
  getDailySnapshot,
  buildDailySnapshot,
  updateSnapshotStory,
  getTodayDateString,
} from '../services/reviewService';
import './DailyReviewPage.css';

const DailyReviewPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [storyExpanded, setStoryExpanded] = useState(false);

  // Editing state
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState('');
  const [savingStory, setSavingStory] = useState(false);
  const textareaRef = useRef(null);

  const today = getTodayDateString();

  // Auto-load on mount: check for saved snapshot, build if missing
  useEffect(() => {
    if (!currentUser) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let saved = await getDailySnapshot(currentUser.uid, today);

        if (!saved) {
          const profile = await getUserProfile(currentUser.uid);
          const displayName = profile?.displayName || 'You';
          saved = await buildDailySnapshot(currentUser.uid, today, displayName);
        }

        setSnapshot(saved);
      } catch (err) {
        console.error('Error loading daily review:', err);
        setError('Something went wrong loading your review. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentUser]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditingStory && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditingStory]);

  const displayStory = snapshot?.userEditedStory ?? snapshot?.aiStory ?? null;

  const handleEditStart = () => {
    setStoryDraft(displayStory || '');
    setIsEditingStory(true);
    setStoryExpanded(true);
  };

  const handleSaveStory = async () => {
    if (!currentUser || savingStory) return;
    setSavingStory(true);
    try {
      await updateSnapshotStory(currentUser.uid, today, storyDraft);
      setSnapshot(prev => ({ ...prev, userEditedStory: storyDraft }));
      setIsEditingStory(false);
    } catch (err) {
      console.error('Error saving story:', err);
    } finally {
      setSavingStory(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingStory(false);
    setStoryDraft('');
  };

  return (
    <div className="daily-review-page">
      <header className="daily-review-header">
        <button className="daily-review-back-btn" onClick={() => navigate('/home')}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="daily-review-title">Daily Review</h1>
        <div className="daily-review-header-spacer" />
      </header>

      <div className="daily-review-content">
        {loading && (
          <div className="daily-review-loading">
            <p>Writing up your day...</p>
          </div>
        )}

        {error && !loading && (
          <div className="daily-review-prompt">
            <p className="daily-review-error">{error}</p>
            <button className="daily-review-generate-btn" onClick={() => window.location.reload()}>
              Try Again
            </button>
          </div>
        )}

        {snapshot && !loading && (
          <div className="daily-review-results">

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

            {/* AI / User Story */}
            {(displayStory !== null || snapshot.missionsCompleted > 0) && (
              <div className="daily-review-story">
                <div className="daily-review-story-header">
                  <span className="daily-review-story-label">
                    {snapshot.userEditedStory ? 'Your Notes' : "Today's Chronicle"}
                  </span>
                  {!isEditingStory && (
                    <button className="daily-review-story-edit-btn" onClick={handleEditStart}>
                      <span className="material-icons">edit</span>
                    </button>
                  )}
                </div>

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
                        onClick={handleCancelEdit}
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
                    No chronicle generated yet. Add your own notes.
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

            {/* Skills Used */}
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

            {/* Quests Advanced */}
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

            <button
              className="daily-review-done-btn"
              onClick={() => navigate('/home')}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyReviewPage;
