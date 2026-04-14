// src/components/achievements/AchievementBadge.jsx
import React from 'react';
import { BADGE_COLORS } from '../../data/achievementDefinitions';
import './AchievementBadge.css';

const SIZES = {
  sm: 56,
  md: 80,
  lg: 110,
};

const ICON_SIZES = {
  sm: '28px',
  md: '40px',
  lg: '56px',
};

/**
 * Renders an achievement badge. When `badgeImage` is provided, displays the PNG.
 * Otherwise falls back to a colored circle with a Material Icon.
 * Pass `locked` to render the greyed-out state for unawarded achievements.
 */
const AchievementBadge = ({ color = 'amber', icon = 'star', badgeImage, size = 'md', locked = false }) => {
  const palette = BADGE_COLORS[color] || BADGE_COLORS.amber;
  const px = SIZES[size] || SIZES.md;
  const iconSize = ICON_SIZES[size] || ICON_SIZES.md;

  if (badgeImage) {
    return (
      <div
        className={`achievement-badge achievement-badge--img achievement-badge--${size}${locked ? ' achievement-badge--locked' : ''}`}
        style={{ width: px, height: px }}
        aria-hidden="true"
      >
        <img
          src={badgeImage}
          alt=""
          className="achievement-badge__img"
          draggable={false}
        />
      </div>
    );
  }

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
