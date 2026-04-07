// src/components/ui/SkillLevelUpModal.js
import React, { useEffect } from 'react';
import './SkillLevelUpModal.css';

const SkillLevelUpModal = ({ skillName, newLevel, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="skill-level-up-overlay" onClick={onClose}>
      <div className="skill-level-up-modal" onClick={(e) => e.stopPropagation()}>

        <div className="skill-level-up-orbs">
          <span className="orb orb-1">◆</span>
          <span className="orb orb-2">◆</span>
          <span className="orb orb-3">◆</span>
          <span className="orb orb-4">◆</span>
          <span className="orb orb-5">◆</span>
        </div>

        <div className="skill-level-up-content">
          <p className="skill-level-up-eyebrow">Skill Up!</p>
          <div className="skill-level-up-badge">
            <span className="skill-level-up-number">{newLevel}</span>
          </div>
          <h2 className="skill-level-up-heading">{skillName}</h2>
          <p className="skill-level-up-subtext">
            Reached level {newLevel}. You're getting good at this.
          </p>
        </div>

        <button className="skill-level-up-close-btn" onClick={onClose}>
          Continue
        </button>

      </div>
    </div>
  );
};

export default SkillLevelUpModal;