// src/pages/SkillsPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, getSPProgressInLevel } from '../services/userService';
import { AVAILABLE_SKILLS } from '../data/Skills';
import './SkillsPage.css';

const SP_PER_SKILL_LEVEL = 40;

const SkillsPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [skillsData, setSkillsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSkills = async () => {
      if (!currentUser) return;
      try {
        const profile = await getUserProfile(currentUser.uid);
        const savedSkills = profile?.skills || {};

        // Build full list from AVAILABLE_SKILLS, merging saved progress
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

        // Sort: skills with SP first (desc), then alphabetically for untouched ones
        merged.sort((a, b) => {
          if (b.totalSP !== a.totalSP) return b.totalSP - a.totalSP;
          return a.name.localeCompare(b.name);
        });

        setSkillsData(merged);
      } catch (error) {
        console.error('Error fetching skills:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSkills();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="skills-page">
        <div className="loading">Loading skills...</div>
      </div>
    );
  }

  return (
    <div className="skills-page">
      <header className="skills-header">
        <button className="skills-back-btn" onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="skills-title">Skills</h1>
        {/* Spacer to balance the back button */}
        <div className="skills-header-spacer" />
      </header>

      <div className="skills-list">
        {skillsData.map((skill) => {
          const hasProgress = skill.totalSP > 0;

          return (
            <div
              key={skill.name}
              className={`skill-card ${hasProgress ? 'skill-card--active' : 'skill-card--inactive'}`}
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SkillsPage;