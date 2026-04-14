// src/pages/AchievementsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getMergedAchievementLibrary } from '../services/achievementService';
import AchievementCard from '../components/achievements/AchievementCard';
import CreateCustomAchievementModal from '../components/achievements/CreateCustomAchievementModal';
import './AchievementsPage.css';

const AchievementsPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [library, setLibrary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchLibrary = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await getMergedAchievementLibrary(currentUser.uid);
      setLibrary(data);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const handleCustomCreated = () => {
    setShowCreateModal(false);
    fetchLibrary();
  };

  if (loading) {
    return (
      <div className="achievements-page">
        <div className="loading">Loading achievements...</div>
      </div>
    );
  }

  const { builtIn = [], custom = [], totalBuiltIn = 0, awardedBuiltInCount = 0 } = library || {};

  return (
    <div className="achievements-page">
      <header className="achievements-header">
        <button className="achievements-back-btn" onClick={() => navigate('/home')}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="achievements-title">Achievements</h1>
        <div className="achievements-header-spacer" />
      </header>

      <div className="achievements-content">

        {/* Built-in achievement grid */}
        <section className="achievements-section">
          <div className="achievements-grid">
            {builtIn.map(achievement => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </section>

        {/* Your Wins — custom achievements */}
        <section className="achievements-section achievements-section--custom">
          <h2 className="achievements-section-title">Your Wins</h2>

          {custom.length === 0 ? (
            <p className="achievements-empty">
              Life happens off-script. Record a personal win — big or small.
            </p>
          ) : (
            <div className="achievements-grid">
              {custom.map(achievement => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
            </div>
          )}
        </section>

        {/* Bottom count pill — spacer so FAB doesn't overlap it */}
        <div className="achievements-bottom-bar">
          <span className="achievements-count-pill">
            {awardedBuiltInCount} / {totalBuiltIn} Unlocked
          </span>
        </div>

      </div>

      {/* Sticky FAB */}
      <button
        className="achievements-fab"
        onClick={() => setShowCreateModal(true)}
        aria-label="Record a Win"
      >
        <span className="material-icons">add</span>
        Record a Win
      </button>

      {showCreateModal && (
        <CreateCustomAchievementModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCustomCreated}
        />
      )}
    </div>
  );
};

export default AchievementsPage;
