// src/components/missions/MissionCardCondensed.jsx
import React, { useState, useEffect } from 'react';
import MissionCardFull from './MissionCardFull';
import Badge from '../ui/Badge';
import {
  MISSION_STATUS,
  hasSkill,
} from '../../types/Mission';
import {
  formatForUser,
  isMissionDueToday,
  isMissionOverdue,
  isMissionDueTomorrow,
  toDateString
} from '../../utils/dateHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { toggleMissionStoryExclusion } from '../../services/missionService';
import { isRecurringMission, getRecurrenceDisplayText } from '../../utils/recurrenceHelpers';
import './MissionCardCondensed.css';

const MissionCardCondensed = ({
  mission,
  onToggleComplete,
  onMissionChanged,
}) => {
  const { currentUser } = useAuth();
  const isCompleted = mission.status === MISSION_STATUS.COMPLETED;
  const missionHasSkill = hasSkill(mission);
  const isRecurring = isRecurringMission(mission);
  const recurrenceText = getRecurrenceDisplayText(mission);
  const [showXpBadge, setShowXpBadge] = useState(false);
  const [viewingDetails, setViewingDetails] = useState(false);
  const [excludeLoading, setExcludeLoading] = useState(false);
  const [excludedFromStory, setExcludedFromStory] = useState(mission.excludeFromStory === true);

  useEffect(() => { setShowXpBadge(isCompleted); }, [isCompleted]);
  useEffect(() => { setExcludedFromStory(mission.excludeFromStory === true); }, [mission.excludeFromStory]);

  const getDueDateInfo = () => {
    if (!mission.dueDate) return null;
    if (isMissionOverdue(mission)) return { status: 'overdue', display: 'Overdue' };
    if (isMissionDueToday(mission)) return { status: 'today', display: 'Today' };
    if (isMissionDueTomorrow(mission)) return { status: 'tomorrow', display: 'Tomorrow' };
    return { status: 'upcoming', display: formatForUser(mission.dueDate) };
  };

  const dueDateInfo = getDueDateInfo();
  const today = toDateString(new Date());
  const completedDate = isCompleted && mission.completedAt
    ? toDateString(mission.completedAt.toDate?.() ?? new Date(mission.completedAt))
    : null;
  const isCompletedToday = completedDate === today;
  const isExcluded = isCompletedToday && excludedFromStory;

  const handleToggleComplete = (e) => {
    e.stopPropagation();
    onToggleComplete(mission.id, isCompleted, mission.xpReward, mission.spReward);
  };

  const handleToggleExclusion = async (e) => {
    e.stopPropagation();
    if (excludeLoading || !currentUser) return;
    setExcludeLoading(true);
    const newExcluded = !excludedFromStory;
    setExcludedFromStory(newExcluded);
    try {
      await toggleMissionStoryExclusion(currentUser.uid, mission.id);
      onMissionChanged?.();
    } catch (err) {
      setExcludedFromStory(!newExcluded);
      console.error('Failed to toggle story exclusion:', err);
    } finally {
      setExcludeLoading(false);
    }
  };

  return (
  <>
    <div className={`mission-card-condensed ${isCompleted ? 'completed' : ''} ${mission.isDailyMission ? 'daily' : ''}`}>
      <div className="mcc-content" onClick={() => setViewingDetails(true)}>
        <div className="mcc-row">
          <h3 className={`mcc-title ${isCompleted ? 'completed' : ''}`}>
            {mission.title}
          </h3>
          <div className="mcc-badges">
            {showXpBadge && mission.xpAwarded && (
              <span className="mcc-xp-badge">+{mission.xpAwarded} XP</span>
            )}
            {isCompletedToday ? (
              <button
                className={`mcc-story-exclusion-chip ${isExcluded ? 'excluded' : ''}`}
                onClick={handleToggleExclusion}
                disabled={excludeLoading}
              >
                {isExcluded ? 'Left out ✓' : "Leave out of today's story"}
              </button>
            ) : (
              <>
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
              </>
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

    {viewingDetails && (
      <MissionCardFull
        mission={mission}
        onClose={() => setViewingDetails(false)}
        onToggleComplete={onToggleComplete}
        onMissionChanged={onMissionChanged}
      />
    )}
  </>
  );
};

export default MissionCardCondensed;
