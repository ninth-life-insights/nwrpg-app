// src/components/tutorial/TutorialPlayButton.jsx
//
// Replaces the toggle button on tutorial mission cards. Tapping opens the
// tutorial overlay for the mission. Visually a small filled circle with
// the play_arrow Material icon.

import React from 'react';
import { useTutorial } from '../../contexts/TutorialContext';
import './TutorialPlayButton.css';

const TutorialPlayButton = ({ mission, size = 'md' }) => {
  const { openStepForMission } = useTutorial();

  const handleClick = (e) => {
    e.stopPropagation();
    // Explicit "show me the tutorial again" — always rewind to the first
    // screen. Saved progress on the user doc is preserved, so if they bail
    // partway through this re-watch, auto-fire on the next session still
    // resumes at their old max.
    openStepForMission(mission, { startFromBeginning: true });
  };

  return (
    <button
      type="button"
      className={`tutorial-play-btn tutorial-play-btn-${size}`}
      onClick={handleClick}
      aria-label="Play tutorial mission"
    >
      <span className="material-icons">play_arrow</span>
    </button>
  );
};

export default TutorialPlayButton;
