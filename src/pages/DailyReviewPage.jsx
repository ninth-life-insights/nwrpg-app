// src/pages/DailyReviewPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../services/userService';
import { buildDailySnapshot, getTodayDateString } from '../services/reviewService';
import './DailyReviewPage.css';

const DailyReviewPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [storyExpanded, setStoryExpanded] = useState(false);

  const handleGenerateReview = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);

    try {
      const profile = await getUserProfile(currentUser.uid);
      const displayName = profile?.displayName || 'You';
      const today = getTodayDateString();

      const result = await buildDailySnapshot(currentUser.uid, today, displayName);
      setSnapshot(result);
    } catch (err) {
      console.error('Error generating daily review:', err);
      setError('Something went wrong generating your review. Please try again.');
    } finally {
      setLoading(false);
    }
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
        {!snapshot && !loading && (
          <div className="daily-review-prompt">
            <p className="daily-review-prompt-text">
              Ready to see how today went?
            </p>
            <button
              className="daily-review-generate-btn"
              onClick={handleGenerateReview}
            >
              Generate Today's Review
            </button>
            {error && <p className="daily-review-error">{error}</p>}
          </div>
        )}

        {loading && (
          <div className="daily-review-loading">
            <p>Writing up your day...</p>
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

            {/* AI Story — collapsed by default */}
            {snapshot.aiStory && (
              <div className="daily-review-story">
                <div className={`daily-review-story-body ${storyExpanded ? 'daily-review-story-body--expanded' : ''}`}>
                  <p>{snapshot.aiStory}</p>
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
