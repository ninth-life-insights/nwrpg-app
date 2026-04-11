// src/components/achievements/AchievementCard.jsx
import React from 'react';
import AchievementBadge from './AchievementBadge';
import './AchievementCard.css';

/**
 * Card for displaying a single achievement in the library grid.
 * Works for both built-in (with isAwarded) and custom achievements.
 */
const AchievementCard = ({ achievement }) => {
  const { name, description, badgeColor, badgeIcon, isAwarded, awardedDate, isCustom } = achievement;

  return (
    <div className={`achievement-card${isAwarded ? ' achievement-card--awarded' : ' achievement-card--locked'}`}>
      <div className="achievement-card__badge">
        <AchievementBadge color={badgeColor} icon={badgeIcon} size="md" locked={!isAwarded} />
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
