// src/components/missions/MissionCardCondensed.jsx
import React, { useState, useEffect } from 'react';
import Badge from '../ui/Badge';
import {
  MISSION_STATUS,
  hasSkill,
} from '../../types/Mission';
import {
  formatForUser,
  isMissionDueToday,
  isMissionOverdue,
  isMissionDueTomorrow
} from '../../utils/dateHelpers';
import { isRecurringMission, getRecurrenceDisplayText } from '../../utils/recurrenceHelpers';
import './MissionCardCondensed.css';

const MissionCardCondensed = ({
  mission,
  onToggleComplete,
  onViewDetails,
}) => {
  const isCompleted = mission.status === MISSION_STATUS.COMPLETED;
  const missionHasSkill = hasSkill(mission);
  const isRecurring = isRecurringMission(mission);
  const recurrenceText = getRecurrenceDisplayText(mission);
  const [showXpBadge, setShowXpBadge] = useState(false);

  useEffect(() => {
    setShowXpBadge(isCompleted);
  }, [isCompleted]);

  const getDueDateInfo = () => {
    if (!mission.dueDate) return null;
    if (isMissionOverdue(mission)) return { status: 'overdue', display: 'Overdue' };
    if (isMissionDueToday(mission)) return { status: 'today', display: 'Today' };
    if (isMissionDueTomorrow(mission)) return { status: 'tomorrow', display: 'Tomorrow' };
    return { status: 'upcoming', display: formatForUser(mission.dueDate) };
  };

  const dueDateInfo = getDueDateInfo();

  const handleToggleComplete = (e) => {
    e.stopPropagation();
    onToggleComplete(mission.id, isCompleted, mission.xpReward, mission.spReward);
  };

  return (
    <div className={`mission-card-condensed ${isCompleted ? 'completed' : ''} ${mission.isDailyMission ? 'daily' : ''}`}>
      <div className="mcc-content" onClick={() => onViewDetails(mission)}>
        <div className="mcc-row">
          <h3 className={`mcc-title ${isCompleted ? 'completed' : ''}`}>
            {mission.title}
          </h3>
          <div className="mcc-badges">
            {showXpBadge && mission.xpAwarded && (
              <span className="mcc-xp-badge">+{mission.xpAwarded} XP</span>
            )}
            {isRecurring && (
              <Badge variant="recurrence">{recurrenceText}</Badge>
            )}
            {dueDateInfo && (
              <Badge variant={`due-${dueDateInfo.status}`}>{dueDateInfo.display}</Badge>
            )}
            <Badge variant="difficulty" difficulty={mission.difficulty}>{mission.difficulty}</Badge>
            {missionHasSkill && (
              <Badge variant="skill">{mission.skill}</Badge>
            )}
          </div>
        </div>
      </div>

      <button
        className={`mcc-toggle ${isCompleted ? 'completed' : ''}`}
        onClick={handleToggleComplete}
        aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        <svg
          className={`mcc-check-icon ${isCompleted ? 'completed' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          height="18px"
          viewBox="0 -960 960 960"
          width="18px"
        >
          <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
        </svg>
      </button>
    </div>
  );
};

export default MissionCardCondensed;
