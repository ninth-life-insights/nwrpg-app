// src/components/achievements/AchievementCard.jsx
import React from 'react';
import AchievementBadge from './AchievementBadge';
import { BADGE_COLORS } from '../../data/achievementDefinitions';
import './AchievementCard.css';

/**
 * Card for displaying a single achievement in the library grid.
 * Works for both built-in (with isAwarded) and custom achievements.
 */
const AchievementCard = ({ achievement }) => {
  const { name, description, badgeColor, badgeIcon, badgeImage, isAwarded, awardedDate, isCustom } = achievement;
  const palette = BADGE_COLORS[badgeColor] || BADGE_COLORS.amber;

  return (
    <div
      className={`achievement-card${isAwarded ? ' achievement-card--awarded' : ' achievement-card--locked'}`}
      style={isAwarded ? { '--card-accent': palette.cardAccent, '--card-accent-bg': palette.bg } : {}}
    >
      {isAwarded && <div className="achievement-card__accent-bar" />}
      <div className="achievement-card__badge">
        <AchievementBadge color={badgeColor} icon={badgeIcon} badgeImage={badgeImage} size="md" locked={!isAwarded} />
      </div>
      <div className="achievement-card__body">
        <p className="achievement-card__name">{name}</p>
        <p className="achievement-card__description">{description}</p>
        {isAwarded && awardedDate && (
          <p className="achievement-card__date">
            {isCustom ? 'Recorded' : 'Unlocked'} {formatDate(awardedDate)}
          </p>
        )}
      </div>
    </div>
  );
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default AchievementCard;
