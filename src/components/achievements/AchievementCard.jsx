// src/components/achievements/AchievementCard.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AchievementBadge from './AchievementBadge';
import { BADGE_COLORS, BUILDER_BADGE_COLORS } from '../../data/achievementDefinitions';
import './AchievementCard.css';

/**
 * Card for displaying a single achievement in the library grid.
 * Works for both built-in (with isAwarded) and custom achievements.
 * Custom achievements get a three-dot menu for edit/delete.
 */
const AchievementCard = ({ achievement, onEdit, onDelete }) => {
  const { name, description, badgeColor, badgeIcon, badgeImage, badgeSymbol, isAwarded, awardedDate, isCustom, isPending, questId } = achievement;
  const palette = BADGE_COLORS[badgeColor] || BUILDER_BADGE_COLORS[badgeColor] || BADGE_COLORS.amber;

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMenu]);

  const card = (
    <div
      className={`achievement-card${isAwarded ? ' achievement-card--awarded' : ' achievement-card--locked'}${isPending && questId ? ' achievement-card--quest-reward' : ''}`}
      style={isAwarded ? { '--card-accent': palette.cardAccent, '--card-accent-bg': palette.bg } : {}}
    >
      {isAwarded && <div className="achievement-card__accent-bar" />}

      {isCustom && (onEdit || onDelete) && (
        <div className="achievement-card__menu" ref={menuRef}>
          <button
            className="achievement-card__menu-btn"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(v => !v); }}
            aria-label="More options"
          >
            <span className="material-icons">more_vert</span>
          </button>
          {showMenu && (
            <div className="achievement-card__dropdown">
              {onEdit && (
                <button
                  className="achievement-card__dropdown-item"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(false); onEdit(achievement); }}
                >
                  <span className="material-icons">edit</span>
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  className="achievement-card__dropdown-item achievement-card__dropdown-item--delete"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(false); onDelete(achievement); }}
                >
                  <span className="material-icons">delete</span>
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="achievement-card__badge">
        <AchievementBadge color={badgeColor} icon={badgeIcon} badgeImage={badgeImage} badgeSymbol={badgeSymbol} size="md" locked={!isAwarded} />
      </div>
      <div className="achievement-card__body">
        <p className="achievement-card__name">{name}</p>
        <p className="achievement-card__description">{description}</p>
        {isAwarded && awardedDate && (
          <p className="achievement-card__date">
            Unlocked {formatDate(awardedDate)}
          </p>
        )}
        {isPending && (
          <p className="achievement-card__date achievement-card__date--pending">Quest reward</p>
        )}
      </div>
    </div>
  );

  if (questId) {
    return <Link to={`/quests/${questId}`} className="achievement-card-link">{card}</Link>;
  }
  return card;
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default AchievementCard;
