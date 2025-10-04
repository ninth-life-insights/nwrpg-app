// src/components/missions/MissionCard.js - WITH DRAG HANDLE
import React, { useState, useEffect } from 'react';
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
 } from '../../utils/dateHelpers';
import { isRecurringMission, getRecurrenceDisplayText } from '../../utils/recurrenceHelpers';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './MissionCard.css';

const MissionCard = ({ 
  mission, 
  onToggleComplete, 
  onViewDetails, 
  isRecentlyCompleted = false,
  selectionMode = false,
  isCustomOrderMode = false
}) => {
  const [showXpBadge, setShowXpBadge] = useState(false);
  
  // Drag and drop setup
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: mission.id,
    disabled: !isCustomOrderMode || selectionMode
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  // Use schema utility functions for consistency
  const isCompleted = mission.status === MISSION_STATUS.COMPLETED;
  const missionHasSkill = hasSkill(mission);
  const canComplete = canCompleteMission(mission);
  const isRecurring = isRecurringMission(mission);
  const recurrenceText = getRecurrenceDisplayText(mission);

  // Handle XP badge display
  useEffect(() => {
    if (isCompleted || isRecentlyCompleted) {
      setShowXpBadge(true);
    } else {
      setShowXpBadge(false);
    }
  }, [isCompleted, isRecentlyCompleted]);
  
  const getDueDateInfo = () => {
    if (!mission.dueDate) return null;
    
    if (isMissionOverdue(mission)) return { status: 'overdue', display: 'Overdue' };
    if (isMissionDueToday(mission)) return { status: 'due-today', display: 'Due Today' };
    if (isMissionDueTomorrow(mission)) return { status: 'due-tomorrow', display: 'Due Tomorrow' };
    
    return {
      status: 'upcoming',
      display: formatForUser(mission.dueDate)
    };
  };

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

  const handleToggleComplete = (e) => {
    e.stopPropagation();
    
    if (isCompleted) {
      onToggleComplete(mission.id, true, mission.xpReward, mission.spReward);
    } else {
      if (canComplete) {
        onToggleComplete(mission.id, false, mission.xpReward, mission.spReward);
      } else {
        console.log('Mission cannot be completed yet');
      }
    }
  };

  return (
  <div 
    ref={setNodeRef} 
    style={style}
    className={`mission-card ${isCompleted || isRecentlyCompleted ? 'completed' : ''} ${mission.isDailyMission ? 'daily-mission-card' : ''} ${mission.pinned ? 'pinned' : ''} ${isDragging ? 'dragging' : ''}`}
  >
    {/* Drag Handle - only visible in custom order mode */}
    {isCustomOrderMode && !selectionMode && (
      <div 
        className="drag-handle"
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }} // Add inline style
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/>
          <circle cx="15" cy="6" r="1.5"/>
          <circle cx="15" cy="12" r="1.5"/>
          <circle cx="15" cy="18" r="1.5"/>
        </svg>
      </div>
    )}

    {/* Content area - remove onClick when in custom order mode to prevent conflicts */}
    <div className="content-area" onClick={() => onViewDetails(mission)}>
        
        {/* Header with title and badges */}
        <div className="mission-header">
          <div className="title-row">
            {showXpBadge && mission.xpAwarded && (
              <span className="xp-completion-badge">
                +{mission.xpAwarded} XP
              </span>
            )}
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
            
            {/* Recurrence badge */}
            {isRecurring && (
              <span className="recurrence-badge" title={`Repeats ${recurrenceText.toLowerCase()}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.5 0 4.74 1.02 6.36 2.68l1.39-1.39"/>
                  <path d="M17 8l4 4-4 4"/>
                </svg>
                {recurrenceText}
              </span>
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
          className={`mission-toggle ${isCompleted || isRecentlyCompleted ? 'completed' : ''}`}
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