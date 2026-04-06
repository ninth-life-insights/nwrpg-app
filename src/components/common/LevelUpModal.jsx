// src/components/ui/LevelUpModal.js
import React, { useEffect } from 'react';
import './LevelUpModal.css';

const LevelUpModal = ({ newLevel, onClose }) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="level-up-overlay" onClick={onClose}>
      <div className="level-up-modal" onClick={(e) => e.stopPropagation()}>

        <div className="level-up-stars">
          <span className="star star-1">✦</span>
          <span className="star star-2">✦</span>
          <span className="star star-3">✦</span>
          <span className="star star-4">✦</span>
          <span className="star star-5">✦</span>
        </div>

        <div className="level-up-content">
          <p className="level-up-eyebrow">Level Up!</p>
          <div className="level-up-badge">
            <span className="level-up-number">{newLevel}</span>
          </div>
          <h2 className="level-up-heading">You reached level {newLevel}.</h2>
          <p className="level-up-subtext">
            One more level cleared. Keep it up.
          </p>
        </div>

        <button className="level-up-close-btn" onClick={onClose}>
          Continue
        </button>

      </div>
    </div>
  );
};

export default LevelUpModal;