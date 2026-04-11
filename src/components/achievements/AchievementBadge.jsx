// src/components/achievements/AchievementBadge.jsx
import React from 'react';
import { BADGE_COLORS } from '../../data/achievementDefinitions';
import './AchievementBadge.css';

const SIZES = {
  sm: 36,
  md: 52,
  lg: 72,
};

const ICON_SIZES = {
  sm: '18px',
  md: '26px',
  lg: '36px',
};

/**
 * Renders a circular badge with a colored background and a Material Icon.
 * Pass `locked` to render greyed-out state for unawarded achievements.
 */
const AchievementBadge = ({ color = 'amber', icon = 'star', size = 'md', locked = false }) => {
  const palette = BADGE_COLORS[color] || BADGE_COLORS.amber;
  const px = SIZES[size] || SIZES.md;
  const iconSize = ICON_SIZES[size] || ICON_SIZES.md;

  const style = {
    width: px,
    height: px,
    backgroundColor: palette.bg,
    borderColor: palette.icon + '33', // 20% opacity border
    '--icon-color': palette.icon,
    '--icon-size': iconSize,
  };

  return (
    <div
      className={`achievement-badge achievement-badge--${size}${locked ? ' achievement-badge--locked' : ''}`}
      style={style}
      aria-hidden="true"
    >
      <span className="material-icons achievement-badge__icon">{icon}</span>
    </div>
  );
};

export default AchievementBadge;
