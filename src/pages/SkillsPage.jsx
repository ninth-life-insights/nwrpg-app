// src/pages/SkillsPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, getSPProgressInLevel } from '../services/userService';
import { AVAILABLE_SKILLS } from '../data/Skills';
import ErrorMessage from '../components/ui/ErrorMessage';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../utils/fetchWithTimeout';
import './SkillsPage.css';

const SP_PER_SKILL_LEVEL = 40;

const SkillsPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [skillsData, setSkillsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    const fetchSkills = async () => {
      if (!currentUser) return;
      if (isDefinitelyOffline()) {
        setLoadError("Your skills didn't load. Check your connection and try again.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setIsLoadingSlow(false);
      const slowTimer = setTimeout(() => setIsLoadingSlow(true), 3000);
      try {
        const profile = await withTimeout(getUserProfile(currentUser.uid));
        const savedSkills = profile?.skills || {};

        const merged = AVAILABLE_SKILLS.map((skillName) => {
          const saved = savedSkills[skillName] || { totalSP: 0, level: 1 };
          const progress = getSPProgressInLevel(saved.totalSP);
          return {
            name: skillName,
            totalSP: saved.totalSP,
            level: saved.level,
            progress,
          };
        });

        // Skills with SP first (desc), then alphabetically
        merged.sort((a, b) => {
          if (b.totalSP !== a.totalSP) return b.totalSP - a.totalSP;
          return a.name.localeCompare(b.name);
        });

        setSkillsData(merged);
      } catch (error) {
        console.error('Error fetching skills:', error);
        setLoadError(getLoadErrorMessage(error, 'skills'));
      } finally {
        clearTimeout(slowTimer);
        setLoading(false);
        setIsLoadingSlow(false);
      }
    };

    fetchSkills();
  }, [currentUser, reloadTrigger]);

  if (loading) {
    return (
      <div className="skills-page">
        <div className="loading">
          Loading skills...
          {isLoadingSlow && <p className="loading-slow-hint">Still searching the realm...</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="skills-page">
      <header className="skills-header">
        <button className="skills-back-btn" onClick={() => navigate('/home')}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="skills-title">Skills</h1>
        <div className="skills-header-spacer" />
      </header>

      {loadError && (
        <ErrorMessage
          message={loadError}
          onRetry={() => { setLoadError(null); setReloadTrigger(t => t + 1); }}
        />
      )}

      <div className="skills-list">
        {skillsData.map((skill) => {
          const hasProgress = skill.totalSP > 0;

          return (
            <button
              key={skill.name}
              className={`skill-card ${hasProgress ? 'skill-card--active' : 'skill-card--inactive'}`}
              onClick={() => navigate(`/skills/${encodeURIComponent(skill.name)}`)}
            >
              <div className="skill-card-top">
                <div className="skill-card-name-group">
                  <span className="skill-card-name">{skill.name}</span>
                  {hasProgress && (
                    <span className="skill-card-level">Lv. {skill.level}</span>
                  )}
                </div>
                <span className="skill-card-sp">
                  {hasProgress ? `${skill.progress.current} / ${SP_PER_SKILL_LEVEL} SP` : '—'}
                </span>
              </div>

              <div className="skill-progress-track">
                <div
                  className="skill-progress-fill"
                  style={{ width: `${hasProgress ? skill.progress.percentage : 0}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SkillsPage;