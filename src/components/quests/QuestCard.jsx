// src/components/quests/QuestCard.js

import React from 'react';
import { useNavigate } from 'react-router-dom';
import MissionCard from '../missions/MissionCard';
import Badge from '../ui/Badge';
import { calculateQuestProgress } from '../../types/Quests';
import './QuestCard.css';

const QuestCard = ({ 
  quest, 
  nextMission, 
  onMissionToggleComplete,
  onMissionViewDetails 
}) => {
  const navigate = useNavigate();
  const progress = calculateQuestProgress(quest);

  const handleViewFullQuest = (e) => {
    e.stopPropagation();
    navigate(`/quests/${quest.id}`);
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'planning':
        return 'Planning';
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      case 'archived':
        return 'Archived';
      default:
        return status;
    }
  };

  return (
    <div className="quest-card">
      {/* Quest Header */}
      <div className="quest-card-header">
        <div className="quest-card-title-row">
          <div className="quest-card-title-section">
            <h3 className="quest-card-title">{quest.title}</h3>
            <div className="quest-card-meta">
              <Badge variant="difficulty" difficulty={quest.difficulty}>
                {quest.difficulty}
              </Badge>
            </div>
          </div>
          <div className="quest-card-progress">
            <div className="progress-circle">
              <svg viewBox="0 0 36 36" className="circular-progress">
                <path
                  className="circle-bg"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle"
                  strokeDasharray={`${progress}, 100`}
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="progress-text">
                <span className="progress-number">{quest.completedMissions}</span>
                <span className="progress-divider">/</span>
                <span className="progress-total">{quest.totalMissions}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Mission Section */}
      {nextMission && quest.status !== 'completed' && (
        <div className="quest-next-mission-section">
          <div className="quest-next-mission-label">Next up:</div>
          <MissionCard
            mission={nextMission}
            onToggleComplete={onMissionToggleComplete}
            onViewDetails={onMissionViewDetails}
          />
        </div>
      )}

      {quest.status === 'completed' && (
        <div className="quest-completed-message">
          <span className="quest-completed-icon">✓</span>
          <span>Quest Complete!</span>
        </div>
      )}

      {/* View Full Quest Button */}
      <button 
        className="view-full-quest-button"
        onClick={handleViewFullQuest}
      >
        View Full Quest <span className="material-icons">double_arrow</span>
      </button>
    </div>
  );
};

export default QuestCard;