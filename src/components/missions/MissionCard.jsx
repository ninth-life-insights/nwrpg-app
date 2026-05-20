// src/components/missions/MissionCard.js - WITH QUEST INDICATOR
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MissionCardFull from './MissionCardFull';
import Badge from '../ui/Badge';
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
  isMissionDueTomorrow,
  toDateString,
} from '../../utils/dateHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { toggleMissionStoryExclusion } from '../../services/missionService';
import { isRecurringMission, isEvergreenMission, getRecurrenceDisplayText } from '../../utils/recurrenceHelpers';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRooms } from '../../contexts/RoomsContext';
import { useQuests } from '../../contexts/QuestsContext';
import { useIsDailyMission } from '../../contexts/DailyMissionsContext';
import './MissionCard.css';

const MissionCard = ({
  mission,
  onToggleComplete,
  onMissionChanged,
  onSelect,
  isRecentlyCompleted = false,
  selectionMode = false,
  isCustomOrderMode = false,
  hideDailyBadge = false,
  hideRoomBadge = false,
  hideQuestIndicator = false,
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { roomsMap } = useRooms();
  const { questsMap } = useQuests();
  const isDailyMission = useIsDailyMission(mission.id);
  const roomName = mission.baseLocation ? roomsMap[mission.baseLocation]?.name ?? null : null;
  const quest = mission.questId ? questsMap[mission.questId] ?? null : null;
  const [showXpBadge, setShowXpBadge] = useState(false);
  const [viewingDetails, setViewingDetails] = useState(false);
  const [excludeLoading, setExcludeLoading] = useState(false);
  const [excludedFromStory, setExcludedFromStory] = useState(mission.excludeFromStory === true);
  
  // Drag and drop setup
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ 
    id: mission.id,
    disabled: !isCustomOrderMode || selectionMode
  });

  const style = {
    transform: CSS.Transform.toString(transform),
  };
  
  // Use schema utility functions for consistency
  const isCompleted = mission.status === MISSION_STATUS.COMPLETED;
  const missionHasSkill = hasSkill(mission);
  const canComplete = canCompleteMission(mission);
  const isRecurring = isRecurringMission(mission);
  const isEvergreen = isEvergreenMission(mission);
  const recurrenceText = getRecurrenceDisplayText(mission);

  useEffect(() => { setShowXpBadge(isCompleted || isRecentlyCompleted); }, [isCompleted, isRecentlyCompleted]);
  useEffect(() => { setExcludedFromStory(mission.excludeFromStory === true); }, [mission.excludeFromStory]);
  
  const getDueDateInfo = () => {
    if (!mission.dueDate) return null;
    
    // Remove "due-" prefix from status since we add it in the Badge variant
    if (isMissionOverdue(mission)) return { status: 'overdue', display: 'Overdue' };
    if (isMissionDueToday(mission)) return { status: 'today', display: 'Today' };
    if (isMissionDueTomorrow(mission)) return { status: 'tomorrow', display: 'Tomorrow' };
    
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

  const today = toDateString(new Date());
  const completedDate = isCompleted && mission.completedAt
    ? toDateString(mission.completedAt.toDate?.() ?? new Date(mission.completedAt))
    : null;
  const isCompletedToday = completedDate === today;
  const isExcluded = isCompletedToday && excludedFromStory;

  const handleToggleExclusion = async (e) => {
    e.stopPropagation();
    if (excludeLoading || !currentUser) return;
    setExcludeLoading(true);
    const newExcluded = !excludedFromStory;
    setExcludedFromStory(newExcluded);
    try {
      await toggleMissionStoryExclusion(currentUser.uid, mission.id);
    } catch (err) {
      setExcludedFromStory(!newExcluded);
      console.error('Failed to toggle story exclusion:', err);
    } finally {
      setExcludeLoading(false);
    }
  };

  const handleToggleComplete = (e) => {
    e.stopPropagation();
    
    if (isCompleted) {
      onToggleComplete(mission.id, true, mission.xpReward, mission.spReward);
    } else {
      if (canComplete) {
        onToggleComplete(mission.id, false, mission.xpReward, mission.spReward);
      }
    }
  };

  const handleQuestClick = (e) => {
    e.stopPropagation();
    if (quest && quest.id) {
      navigate(`/quests/${quest.id}`);
    }
  };

  return (
  <>
  <div
    ref={setNodeRef}
    style={style}
    className={`mission-card ${isCompleted || isRecentlyCompleted ? 'completed' : ''} ${mission.status === MISSION_STATUS.EXPIRED ? 'archived-mission-card' : isDailyMission ? 'daily-mission-card' : mission.isPriority ? 'priority-mission-card' : quest && !hideQuestIndicator ? 'quest-mission-card' : ''} ${isDragging ? 'dragging' : ''}`}
  >
    {/* Drag Handle - only visible in custom order mode */}
    {isCustomOrderMode && !selectionMode && (
      <div 
        className="drag-handle"
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
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

    {/* Content area */}
    <div className="content-area" onClick={() => {
      if (selectionMode && onSelect) {
        onSelect(mission);
      } else if (!selectionMode) {
        setViewingDetails(true);
      }
    }}>
        
        {/* Header with title and badges */}
        <div className="mission-header">
          <div className="title-row">
            {showXpBadge && mission.xpAwarded && (
              <span className="xp-completion-badge">
                +{mission.xpAwarded} XP
              </span>
            )}
            <h3 className={`mission-title ${isCompleted ? 'completed' : ''}`}>
              {mission.isPriority && (
                <span className="material-icons priority-flag" aria-label="Priority mission">flag</span>
              )}
              {mission.title}
            </h3>
          </div>
          
          <div className="badges">

            {isCompletedToday && !selectionMode && (
              <button
                type="button"
                className={`story-exclusion-chip ${isExcluded ? 'excluded' : ''}`}
                onClick={handleToggleExclusion}
                disabled={excludeLoading}
              >
                {isExcluded ? 'Left out ✓' : 'Leave out of today\'s story'}
              </button>
            )}

            {isDailyMission && !hideDailyBadge && (
              <Badge variant="daily">Daily</Badge>
            )}
            
            {/* Recurrence badge */}
            {isRecurring && (
              <Badge variant="recurrence">
                {recurrenceText}
              </Badge>
            )}

            {/* Evergreen badge */}
            {isEvergreen && (
              <Badge variant="evergreen">Evergreen</Badge>
            )}

            {/* Due date badge */}
            {dueDateInfo && (
              <Badge variant={`due-${dueDateInfo.status}`}>
                {dueDateInfo.display}
              </Badge>
            )}

            {/* Room badge */}
            {roomName && !hideRoomBadge && (
              <Badge variant="room" icon="home">{roomName}</Badge>
            )}

            {/* Quest badge */}
            {quest && !hideQuestIndicator && (
              <div onClick={handleQuestClick} style={{ display: 'inline-block' }}>
                <Badge variant="quest-card">Quest: {quest.title}</Badge>
              </div>
            )}

            <Badge variant="difficulty" difficulty={mission.difficulty}>{mission.difficulty}</Badge>

            {/* Skill badge */}
            {missionHasSkill && (
              <Badge variant="skill">{mission.skill}</Badge>
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

    {viewingDetails && (
      <MissionCardFull
        mission={mission}
        onClose={() => setViewingDetails(false)}
        onToggleComplete={onToggleComplete}
        onMissionChanged={onMissionChanged}
        onExclusionToggled={(val) => setExcludedFromStory(val)}
        excludedFromStory={excludedFromStory}
      />
    )}
  </>
  );
};

export default MissionCard;
