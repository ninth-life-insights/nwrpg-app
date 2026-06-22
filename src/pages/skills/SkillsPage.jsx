// src/pages/SkillsPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTutorial } from '../../contexts/TutorialContext';
import { getUserProfile, getSPProgressInLevel } from '../../services/userService';
import { AVAILABLE_SKILLS } from '../../data/Skills';
import ErrorMessage from '../../components/ui/ErrorMessage';
import LoadingTransition from '../../components/ui/LoadingTransition';
import SkillsPageSkeleton from './SkillsPageSkeleton';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
import { useAndroidBackButton } from '../../hooks/useAndroidBackButton';
import './SkillsPage.css';

const SkillsPage = () => {
  const { currentUser } = useAuth();
  const { triggerStep } = useTutorial();
  useEffect(() => {
    triggerStep('skills');
    return () => triggerStep(null);
  }, [triggerStep]);
  const navigate = useNavigate();
  const [skillsData, setSkillsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const handleBack = () => navigate('/home');
  useAndroidBackButton(handleBack);

  useEffect(() => {
    const fetchSkills = async () => {
      if (!currentUser) return;
      if (isDefinitelyOffline()) {
        setLoadError("Your skills didn't load. Check your connection and try again.");
        setLoading(false);
        return;
      }
      setLoading(true);
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
        setLoading(false);
      }
    };

    fetchSkills();
  }, [currentUser, reloadTrigger]);

  return (
    <LoadingTransition loading={loading} skeleton={<SkillsPageSkeleton />}>
    <div className="skills-page">
      <header className="skills-header">
        <button className="skills-back-btn" onClick={handleBack}>
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
                  {hasProgress ? `${skill.progress.current} / ${skill.progress.required} SP` : '—'}
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
    </LoadingTransition>
  );
};

export default SkillsPage;