// src/components/missions/MissionCardFull.js
import React from 'react';
import DifficultyBadge from './sub-components/DifficultyBadge';
import {
  MISSION_STATUS,
  isMissionDueToday,
  isMissionDueTomorrow,
  isMissionOverdue,
  getDaysUntilDue
} from '../../types/Mission';
import './MissionCardFull.css';

const MissionCardFull = ({ mission, onClose, onToggleComplete }) => {
  // FIXED: Use consistent due date logic from schema
  const getDueDateInfo = () => {
    if (!mission.dueDate) return null;
    
    if (isMissionOverdue(mission)) return { status: 'overdue', display: 'Overdue' };
    if (isMissionDueToday(mission)) return { status: 'due-today', display: 'Due Today' };
    if (isMissionDueTomorrow(mission)) return { status: 'due-tomorrow', display: 'Due Tomorrow' };
    
    // For other upcoming dates, show the actual date
    const date = mission.dueDate.toDate ? mission.dueDate.toDate() : new Date(mission.dueDate);
    const daysUntil = getDaysUntilDue(mission);
    
    if (daysUntil <= 7) {
      return {
        status: 'upcoming-week',
        display: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      };
    }
    
    return {
      status: 'upcoming',
      display: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
  };

  const formatExpiryDate = (expiryDate) => {
    if (!expiryDate) return null;
    
    // Handle both Firestore timestamp and regular Date objects
    const date = expiryDate.toDate ? expiryDate.toDate() : new Date(expiryDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCreatedDate = (createdAt) => {
    if (!createdAt) return null;
    
    // Handle both Firestore timestamp and regular Date objects
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const dueDateInfo = getDueDateInfo();
  const expiryDisplay = formatExpiryDate(mission.expiryDate);
  const createdDisplay = formatCreatedDate(mission.createdAt);
  
  // Determine if mission is completed using schema constant
  const isCompleted = mission.status === MISSION_STATUS.COMPLETED;

  return (
    <div className="mission-detail-overlay" onClick={onClose}>
      <div className="mission-detail-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="mission-detail-header">
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Mission Content */}
        <div className="mission-detail-content">
          
          {/* Daily Mission Badge - Above Title */}
          {mission.isDailyMission && (
            <div className="daily-mission-header">
              <span className="daily-mission-badge-orange">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
                Daily Mission
              </span>
            </div>
          )}
          
          {/* Title */}
          <div className="mission-title-section">
            <h2 className={`mission-detail-title ${isCompleted ? 'completed' : ''}`}>
              {mission.title}
            </h2>
            
            {/* Description - directly below title */}
            <div className="mission-description">
              <p>{mission.description || 'No description provided'}</p>
            </div>
          </div>

          {/* Badges - All on one line */}
          <div className="mission-badges">
            <DifficultyBadge difficulty={mission.difficulty} />
            
            <span className="status-badge-inline">
              Status: {isCompleted ? 'Completed' : 'Active'}
            </span>
            
            {dueDateInfo && (
              <span className={`due-date-badge ${dueDateInfo.status}`}>
                {dueDateInfo.display}
              </span>
            )}
            
            {mission.skill && (
              <span className="skill-badge">
                Skill: {mission.skill}
              </span>
            )}

            {mission.category && (
              <span className="category-badge">
                {mission.category}
              </span>
            )}
          </div>

          {/* Mission Details */}
          <div className="mission-details">
            {createdDisplay && (
              <div className="detail-item">
                <h4>Created</h4>
                <p>{createdDisplay}</p>
              </div>
            )}
            
            {expiryDisplay && (
              <div className="detail-item">
                <h4>Expires</h4>
                <p>{expiryDisplay}</p>
              </div>
            )}

            {isCompleted && mission.completedAt && (
              <div className="detail-item">
                <h4>Completed</h4>
                <p>{formatCreatedDate(mission.completedAt)}</p>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="mission-actions">
            <button
              onClick={() => onToggleComplete(mission.id, isCompleted, mission.xpReward)}
              className={`action-button ${isCompleted ? 'mark-incomplete' : 'mark-complete'}`}
            >
              {isCompleted ? 'Mark as Incomplete' : 'Mark as Complete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissionCardFull;