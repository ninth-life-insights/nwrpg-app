// src/components/tutorial/TutorialStepToast.jsx
//
// Lightweight completion feedback for tutorial mission steps. Mirrors the
// shape and timing of AchievementToast so the celebration vocabulary stays
// consistent. Tapping the toast routes to the tutorial quest's detail view
// (where the user can see the quest checking off if they want to).

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './TutorialStepToast.css';

const AUTO_DISMISS_MS = 3500;

const TutorialStepToast = ({ step, onDismiss }) => {
  const navigate = useNavigate();

  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });

  useEffect(() => {
    if (!step) return;
    const timer = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [step]);

  if (!step) return null;

  const handleClick = () => {
    onDismiss();
    if (step.questId) navigate(`/quests/${step.questId}`);
  };

  return (
    <div className="tutorial-step-toast-wrapper" role="status" aria-live="polite">
      <div
        className="tutorial-step-toast"
        onClick={handleClick}
        role="button"
        style={{ cursor: 'pointer' }}
      >
        <div className="tutorial-step-toast__icon">
          <span className="material-icons">check_circle</span>
        </div>
        <div className="tutorial-step-toast__text">
          <span className="tutorial-step-toast__label">Tutorial step complete</span>
          <span className="tutorial-step-toast__name">{step.missionTitle}</span>
        </div>
        <button
          className="tutorial-step-toast__close"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          aria-label="Dismiss"
        >
          <span className="material-icons">close</span>
        </button>
      </div>
    </div>
  );
};

export default TutorialStepToast;
