// src/components/missions/MissionCard.js
import React from 'react';
import DifficultyBadge from './DifficultyBadge';
import './MissionCard.css';

const MissionCard = ({ mission, onToggleComplete, onViewDetails }) => {
  // Helper function to determine due date status
  const getDueDateStatus = (dueDate) => {
    if (!dueDate) return null;
    
    const today = new Date();
    const due = new Date(dueDate);
    
    // Reset time to compare dates only
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'due-today';
    return 'upcoming';
  };

  // Helper function to format due date display
  const formatDueDate = (dueDate) => {
    if (!dueDate) return null;
    
    const date = new Date(dueDate);
    const status = getDueDateStatus(dueDate);
    
    if (status === 'due-today') return 'Due Today';
    if (status === 'overdue') return 'Overdue';
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const dueDateStatus = getDueDateStatus(mission.dueDate);
  const dueDateDisplay = formatDueDate(mission.dueDate);

  return (
    <div className={`mission-card ${mission.completed ? 'completed' : ''}`}>
      
      {/* Content area */}
      <div className="content-area" onClick={() => onViewDetails(mission)}>
        <div className="mission-header">
          <h3 className={`mission-title ${mission.completed ? 'completed' : ''}`}>
            {mission.title}
          </h3>
          <div className="badges">
            <DifficultyBadge difficulty={mission.difficulty} />
            {dueDateDisplay && (
              <span className={`due-date-badge ${dueDateStatus}`}>
                {dueDateDisplay}
              </span>
            )}
          </div>
        </div>

        <div className="mission-description">
          <p>{mission.description}</p>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation(); onToggleComplete(mission.id)}}
        className="mission-toggle"
        aria-label={mission.completed ? 'Mark as incomplete' : 'Mark as complete'}
      >
        <svg 
          className={`check-icon ${mission.completed ? 'completed' : ''}`}
          xmlns="http://www.w3.org/2000/svg" 
          height="24px" 
          viewBox="0 -960 960 960" 
          width="24px"
        >
          <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
        </svg>
      </button>
    </div>
  );
};

export default MissionCard;