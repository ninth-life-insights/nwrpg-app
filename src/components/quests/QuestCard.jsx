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
  onToggleComplete,
  onRestore,
  activeMissionCount,
}) => {
  const navigate = useNavigate();
  const displayTotal = activeMissionCount ?? quest.totalMissions;
  const progress = calculateQuestProgress(quest, activeMissionCount);
  const isCompleted = quest.status === 'completed';

  const handleViewFullQuest = (e) => {
    e.stopPropagation();
    navigate(`/quests/${quest.id}`);
  };

  const handleToggleComplete = (e) => {
    e.stopPropagation();
    if (onToggleComplete) {
      onToggleComplete(quest.id, isCompleted);
    }
  };

  return (
    <div className={`quest-card ${isCompleted ? 'completed' : ''}`} onClick={handleViewFullQuest}>
      {/* Quest Header */}
      <div className="quest-card-header">
        <div className="quest-card-title-row">
          {onToggleComplete && (
            <button
              type="button"
              onClick={handleToggleComplete}
              className={`quest-toggle ${isCompleted ? 'completed' : ''}`}
              aria-label={isCompleted ? 'Reopen quest' : 'Complete quest'}
            >
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
          )}
          <div className="quest-card-title-section">
            <h3 className={`quest-card-title ${isCompleted ? 'completed' : ''}`}>{quest.title}</h3>
            <div className="quest-card-meta">
              <Badge variant="difficulty" difficulty={quest.difficulty}>
                {quest.difficulty}
              </Badge>
              {isCompleted && quest.xpAwarded && (
                <Badge variant="xp-completion">+{quest.xpAwarded} XP</Badge>
              )}
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
                <span className="progress-total">{displayTotal}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Mission Section */}
      {nextMission && !isCompleted && (
        <div
          className="quest-next-mission-section"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="quest-next-mission-label">Next up:</div>
          <MissionCard
            mission={nextMission}
            onToggleComplete={onMissionToggleComplete}
          />
        </div>
      )}

      {/* Quest Actions */}
      <div className={`quest-card-actions ${onRestore ? 'has-restore' : ''}`}>
        <button
          className="view-full-quest-button"
          onClick={handleViewFullQuest}
        >
          View Full Quest <span className="material-icons">double_arrow</span>
        </button>
        {onRestore && (
          <button
            className="restore-quest-button"
            onClick={(e) => {
              e.stopPropagation();
              onRestore(quest.id);
            }}
          >
            Restore
          </button>
        )}
      </div>
    </div>
  );
};

export default QuestCard;