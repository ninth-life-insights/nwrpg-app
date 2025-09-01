// src/pages/HomePage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import './HomePage.css';

const HomePage = () => {
  const { currentUser } = useAuth();
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCharacterData = async () => {
      if (!currentUser) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCharacter(userData.character);
        }
      } catch (error) {
        console.error('Error fetching character data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCharacterData();
  }, [currentUser]);

  // Mock data for daily missions (replace with real data later)
  const dailyMissions = [
    { id: 1, title: "Complete morning laundry cycle", completed: false },
    { id: 2, title: "10-minute morning meditation", completed: true },
    { id: 3, title: "Take vitamins and supplements", completed: false }
  ];

  // Calculate current XP and level progress
  const getXPForLevel = (level) => level * 100; // Simple formula
  const currentXP = character?.experience || 0;
  const currentLevel = character?.level || 1;
  const xpForCurrentLevel = getXPForLevel(currentLevel - 1);
  const xpForNextLevel = getXPForLevel(currentLevel);
  const progressXP = currentXP - xpForCurrentLevel;
  const requiredXP = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = (progressXP / requiredXP) * 100;

  if (loading) {
    return (
      <div className="homepage-container">
        <div className="loading">Loading your adventure...</div>
      </div>
    );
  }

  return (
    <div className="homepage-container">
      {/* Header */}
      <header className="homepage-header">
        <button className="header-button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Daily Planning
        </button>
        
        <button className="header-button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9,11 12,14 22,4"/>
            <path d="M21,12v7a2,2 0,0 1,-2,2H5a2,2 0,0 1,-2,-2V5a2,2 0,0 1,2,-2h11"/>
          </svg>
          Daily Review
        </button>
        
        <button className="header-button settings-button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4,15a1.65,1.65 0,0 0,.33,1.82l.06.06a2,2 0,0 1,0,2.83 2,2 0,0 1,-2.83,0l-.06-.06a1.65,1.65 0,0 0,-1.82-.33 1.65,1.65 0,0 0,-1,1.51V21a2,2 0,0 1,-2,2 2,2 0,0 1,-2,-2v-.09A1.65,1.65 0,0 0,9,19.4a1.65,1.65 0,0 0,-1.82.33l-.06.06a2,2 0,0 1,-2.83,0 2,2 0,0 1,0,-2.83l.06-.06a1.65,1.65 0,0 0,.33,-1.82 1.65,1.65 0,0 0,-1.51,-1H3a2,2 0,0 1,-2,-2 2,2 0,0 1,2,-2h.09A1.65,1.65 0,0 0,4.6,9a1.65,1.65 0,0 0-.33,-1.82L4.21,7.11a2,2 0,0 1,0,-2.83 2,2 0,0 1,2.83,0l.06.06a1.65,1.65 0,0 0,1.82.33H9a1.65,1.65 0,0 0,1,1.51V3a2,2 0,0 1,2,-2 2,2 0,0 1,2,2v.09a1.65,1.65 0,0 0,1,1.51 1.65,1.65 0,0 0,1.82-.33l.06-.06a2,2 0,0 1,2.83,0 2,2 0,0 1,0,2.83l-.06.06a1.65,1.65 0,0 0-.33,1.82V9a1.65,1.65 0,0 0,1.51,1H21a2,2 0,0 1,2,2 2,2 0,0 1,-2,2h-.09a1.65,1.65 0,0 0,-1.51,1z"/>
          </svg>
        </button>
      </header>

      {/* Profile Section */}
      <section className="profile-section">
        <div className="profile-content">
          <div className="avatar-container">
            <div 
              className="character-avatar" 
              style={{ 
                backgroundColor: character?.color ? `var(--color-${character.color})` : '#3b82f6' 
              }}
            >
              <span className="avatar-class">{character?.class || 'Adventurer'}</span>
            </div>
          </div>
          
          <div className="profile-info">
            <h2 className="character-name">{character?.name || 'Adventurer'}</h2>
            <p className="character-title">"{character?.title || 'Getting Started'}"</p>
            <div className="level-info">
              <span className="current-level">Level {currentLevel}</span>
            </div>
            <div className="xp-section">
              <div className="xp-bar">
                <div 
                  className="xp-progress" 
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <div className="xp-counter">
                {progressXP} / {requiredXP} XP
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Missions Section */}
      <section className="daily-missions-section">
        <div className="section-header">
          <h3 className="section-title">Daily Mission</h3>
          <button className="edit-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
        
        <div className="missions-overview">
          {dailyMissions.map((mission) => (
            <div key={mission.id} className={`mission-item ${mission.completed ? 'completed' : ''}`}>
              <div className="mission-checkbox">
                {mission.completed ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9,11 12,14 22,4"/>
                  </svg>
                ) : (
                  <div className="checkbox-empty"></div>
                )}
              </div>
              <span className="mission-title">{mission.title}</span>
            </div>
          ))}
        </div>

        <div className="action-buttons">
          <button className="action-button primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Quests
          </button>
          <button className="action-button secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M7 15h0M12 15h0M17 15h0"/>
            </svg>
            Mission Bank
          </button>
        </div>
      </section>
    </div>
  );
};

export default HomePage;