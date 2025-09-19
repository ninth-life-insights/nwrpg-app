// src/components/missions/MissionCard.js
import React from 'react';
import DifficultyBadge from './sub-components/DifficultyBadge';
import {
  MISSION_STATUS,
  COMPLETION_TYPES,
  hasSkill,
  canCompleteMission
} from '../../types/Mission';
import { 
  formatForUser,
  isMissionDueToday,
  isMissionOverdue,
  isMissionDueTomorrow
 } from '../../../utils/dateHelpers';
import './MissionCard.css';

const MissionCard = ({ mission, onToggleComplete, onViewDetails }) => {
  
  // Use schema utility functions for consistency
  const isCompleted = mission.status === MISSION_STATUS.COMPLETED;
  const missionHasSkill = hasSkill(mission);
  const canComplete = canCompleteMission(mission);
  
  const getDueDateInfo = () => {
    if (!mission.dueDate) return null;
    
    if (isMissionOverdue(mission)) return { status: 'overdue', display: 'Overdue' };
    if (isMissionDueToday(mission)) return { status: 'due-today', display: 'Due Today' };
    if (isMissionDueTomorrow(mission)) return { status: 'due-tomorrow', display: 'Due Tomorrow' };
    
    // For other upcoming dates, show the actual date
    return {
      status: 'upcoming',
      display: formatForUser(mission.dueDate)
    };
  };

  // Get completion type display info
  const getCompletionTypeInfo = () => {
    switch (mission.completionType) {
      case COMPLETION_TYPES.TIMER:
        const hours = Math.floor(mission.timerDurationMinutes / 60);
        const minutes = mission.timerDurationMinutes % 60;
        let timeStr = '';
        if (hours > 0) timeStr += `${hours}h `;
        if (minutes > 0) timeStr += `${minutes}m`;
        return { type: 'timer', display: timeStr.trim() };
        
      case COMPLETION_TYPES.COUNT:
        return { 
          type: 'count', 
          display: `${mission.currentCount || 0}/${mission.targetCount}` 
        };
        
      default:
        return null;
    }
  };

  const dueDateInfo = getDueDateInfo();
  const completionInfo = getCompletionTypeInfo();

  // Handle completion toggle with schema validation
  const handleToggleComplete = (e) => {
    e.stopPropagation();
    
    if (isCompleted) {
      // Always allow uncompleting
      onToggleComplete(mission.id, true, mission.xpReward, mission.spReward);
    } else {
      // Check if mission can be completed based on completion type
      if (canComplete) {
        onToggleComplete(mission.id, false, mission.xpReward, mission.spReward);
      } else {
        // Could show a toast here about why it can't be completed
        console.log('Mission cannot be completed yet');
      }
    }
  };

  return (
    <div className={`mission-card ${isCompleted ? 'completed' : ''} ${mission.isDailyMission ? 'daily-mission-card' : ''} ${mission.pinned ? 'pinned' : ''}`}>
      
      {/* Content area */}
      <div className="content-area" onClick={() => onViewDetails(mission)}>
        
        {/* Header with title and badges */}
        <div className="mission-header">
          <div className="title-row">
            <h3 className={`mission-title ${isCompleted ? 'completed' : ''}`}>
              {mission.title}
            </h3>
            {mission.pinned && (
              <span className="pin-indicator" title="Pinned mission">📌</span>
            )}
          </div>
          
          <div className="badges">

            {/* Daily mission badge */}
            {mission.isDailyMission && (
              <span className="daily-mission-badge">Daily</span>
            )}
            

            <DifficultyBadge difficulty={mission.difficulty} />

            
            {/* Due date badge */}
            {dueDateInfo && (
              <span className={`due-date-badge ${dueDateInfo.status}`}>
                {dueDateInfo.display}
              </span>
            )}
            
            {/* High priority badge */}
            {mission.priority === 'high' && (
              <span className="priority-badge high">High Priority</span>
            )}
            
            {/* Skill badge */}
            {missionHasSkill && (
              <span className="skill-badge-mini">{mission.skill}</span>
            )}
          </div>
        </div>

        {/* Description */}
        {mission.description && (
          <div className="mission-description">
            <p>{mission.description}</p>
          </div>
        )}

        {/* Completion progress (for timer/count missions) */}
        {completionInfo && (
          <div className="completion-progress">
            <div className="progress-info">
              <span className="progress-label">
                {completionInfo.type === 'timer' ? 'Duration:' : 'Progress:'}
              </span>
              <span className="progress-value">{completionInfo.display}</span>
            </div>
            
            {/* Progress bar for count missions */}
            {completionInfo.type === 'count' && mission.targetCount > 0 && (
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${Math.min(100, ((mission.currentCount || 0) / mission.targetCount) * 100)}%` 
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action button - completion toggle */}
      <div className="mission-actions">
        <button
          onClick={handleToggleComplete}
          className={`mission-toggle ${isCompleted ? 'completed' : ''}`}
          aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {/* Checkmark icon */}
          <svg 
            className={`check-icon ${isCompleted ? 'completed' : ''}`}
            xmlns="http://www.w3.org/2000/svg" 
            height="20px" 
            viewBox="0 -960 960 960" 
            width="20px"
          >
            <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
          </svg>
        </button>
        

      </div>
    </div>
  );
};

export default MissionCard;