// src/components/missions/MissionCardFull.js
import React from 'react';
import DifficultyBadge from './DifficultyBadge';
import './MissionCardFull.css';

const MissionCardFull = ({ mission, onClose, onToggleComplete }) => {
  const getDueDateStatus = (dueDate) => {
    if (!dueDate) return null;
    
    const today = new Date();
    const due = new Date(dueDate);
    
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'due-today';
    return 'upcoming';
  };

  const formatDueDate = (dueDate) => {
    if (!dueDate) return null;
    
    const date = new Date(dueDate);
    const status = getDueDateStatus(dueDate);
    
    if (status === 'due-today') return 'Due Today';
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatExpiryDate = (expiryDate) => {
    if (!expiryDate) return null;
    
    const date = new Date(expiryDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const dueDateStatus = getDueDateStatus(mission.dueDate);
  const dueDateDisplay = formatDueDate(mission.dueDate);
  const expiryDisplay = formatExpiryDate(mission.expiryDate);

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
            <h2 className={`mission-detail-title ${mission.completed ? 'completed' : ''}`}>
              {mission.title}
            </h2>
            
            {/* Description - directly below title */}
            <div className="mission-description">
              <p>{mission.description}</p>
            </div>
          </div>

          {/* Badges - All on one line */}
          <div className="mission-badges">
            <DifficultyBadge difficulty={mission.difficulty} />
            
            <span className="status-badge-inline">
              Status: {mission.completed ? 'Completed' : 'Pending'}
            </span>
            
            {dueDateDisplay && (
              <span className={`due-date-badge ${dueDateStatus}`}>
                {dueDateDisplay}
              </span>
            )}
            
            {mission.skill && (
              <span className="skill-badge">
                Skill: {mission.skill}
              </span>
            )}
          </div>

          {/* Mission Details - Only Expiry Date */}
          {expiryDisplay && (
            <div className="mission-details">
              <div className="detail-item">
                <h4>Expires</h4>
                <p>{expiryDisplay}</p>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="mission-actions">
            <button
              onClick={() => onToggleComplete(mission.id)}
              className={`action-button ${mission.completed ? 'mark-incomplete' : 'mark-complete'}`}
            >
              {mission.completed ? 'Mark as Incomplete' : 'Mark as Complete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissionCardFull;