// src/components/missions/MissionCardFull.js
import React from 'react';
import DifficultyBadge from './sub-components/DifficultyBadge';
import Badge from '../ui/Badge';
import {
  MISSION_STATUS,
} from '../../types/Mission';
import {
  isMissionDueToday,
  isMissionDueTomorrow,
  isMissionOverdue,
  formatForUser
} from '../../utils/dateHelpers';
import { isRecurringMission, getRecurrenceDisplayText } from '../../utils/recurrenceHelpers';
import './MissionCardFull.css';

const MissionCardFull = ({ mission, onClose, onToggleComplete, onDeleteMission }) => {
  // FIXED: Use consistent due date logic from schema
  const getDueDateInfo = () => {
    if (!mission.dueDate) return null;
        
        if (isMissionOverdue(mission)) return { status: 'overdue', display: 'Overdue' };
        if (isMissionDueToday(mission)) return { status: 'today', display: 'Due Today' };
        if (isMissionDueTomorrow(mission)) return { status: 'tomorrow', display: 'Due Tomorrow' };
        
        // For other upcoming dates, show the actual date
        return {
          status: 'upcoming',
          display: formatForUser(mission.dueDate)
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
  const isRecurring = isRecurringMission(mission);
  const recurrenceText = getRecurrenceDisplayText(mission);
  
  // Determine if mission is completed using schema constant
  const isCompleted = mission.status === MISSION_STATUS.COMPLETED;

  const handleDeleteMission = async () => {
    if (onDeleteMission) {
      await onDeleteMission(mission.id);
    }
  };

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
              <Badge variant="daily" icon="sunny">Daily</Badge>
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

            {/* Recurrence badge */}
            {isRecurring && (
              <Badge variant="recurrence">{recurrenceText}</Badge>
            )}
            
            {dueDateInfo && (
              <Badge variant={`due-${dueDateInfo.status}`}>
                {dueDateInfo.display}
              </Badge>
            )}

            <Badge variant="difficulty" difficulty={mission.difficulty}>{mission.difficulty}</Badge>
            
            {mission.skill && (
              <Badge variant="skill">Skill: {mission.skill}</Badge>
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

          {/* Action Buttons */}
          <div className="mission-actions">
            <button
              onClick={handleDeleteMission}
              className="action-button delete-button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              Delete Mission
            </button>
            
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