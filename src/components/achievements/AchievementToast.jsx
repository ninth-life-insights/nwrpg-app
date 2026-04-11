// src/components/achievements/AchievementToast.jsx
import React, { useEffect, useRef } from 'react';
import AchievementBadge from './AchievementBadge';
import './AchievementToast.css';

const AUTO_DISMISS_MS = 4000;

/**
 * Shows a stack of achievement unlock notifications at the bottom of the screen.
 * achievements: array of achievement definition objects
 * onDismiss: called when all toasts have been dismissed (or auto-dismissed)
 */
const AchievementToast = ({ achievements, onDismiss }) => {
  // Keep a stable ref so re-renders from parent data fetches don't reset the timer
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });

  useEffect(() => {
    if (!achievements || achievements.length === 0) return;
    const timer = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [achievements]); // Only re-arm when achievements array itself changes

  if (!achievements || achievements.length === 0) return null;

  return (
    <div className="achievement-toast-stack" role="status" aria-live="polite">
      {achievements.map((a) => (
        <div key={a.id} className="achievement-toast">
          <AchievementBadge color={a.badgeColor} icon={a.badgeIcon} size="sm" />
          <div className="achievement-toast__text">
            <span className="achievement-toast__label">Achievement Unlocked</span>
            <span className="achievement-toast__name">{a.name}</span>
          </div>
          <button className="achievement-toast__close" onClick={onDismiss} aria-label="Dismiss">
            <span className="material-icons">close</span>
          </button>
        </div>
      ))}
    </div>
  );
};

export default AchievementToast;
