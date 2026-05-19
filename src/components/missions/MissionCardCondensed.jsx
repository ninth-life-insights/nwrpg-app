// src/components/missions/MissionCardCondensed.jsx
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
  readOnly = false,
  actionSlot = null,
}) => {
  const { currentUser } = useAuth();
  const isCompleted = mission.status === MISSION_STATUS.COMPLETED;
  const missionHasSkill = hasSkill(mission);
  const isRecurring = isRecurringMission(mission);
  const recurrenceText = getRecurrenceDisplayText(mission);
  const titleRef = useRef(null);
  const [titleMinWidth, setTitleMinWidth] = useState(150);
  const [showXpBadge, setShowXpBadge] = useState(false);
  const [viewingDetails, setViewingDetails] = useState(false);
  const [excludeLoading, setExcludeLoading] = useState(false);
  const [excludedFromStory, setExcludedFromStory] = useState(mission.excludeFromStory === true);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const cs = window.getComputedStyle(el);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const textWidth = Math.ceil(ctx.measureText(mission.title).width) + 2;
    setTitleMinWidth(Math.min(textWidth, 150));
  }, [mission.title]);

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
    } catch (err) {
      setExcludedFromStory(!newExcluded);
      console.error('Failed to toggle story exclusion:', err);
    } finally {
      setExcludeLoading(false);
    }
  };

  const cardClass = readOnly
    ? 'mission-card-condensed readonly'
    : `mission-card-condensed ${isCompleted ? 'completed' : ''} ${mission.isDailyMission ? 'daily' : ''}`;
  const titleClass = readOnly
    ? 'mcc-title'
    : `mcc-title ${isCompleted ? 'completed' : ''}`;

  return (
  <>
    <div className={cardClass}>
      <div
        className="mcc-content"
        onClick={readOnly ? undefined : () => setViewingDetails(true)}
        style={readOnly ? { cursor: 'default' } : undefined}
      >
        <div className="mcc-row">
          <h3
            ref={titleRef}
            className={titleClass}
            style={{ minWidth: titleMinWidth }}
          >
            {mission.title}
          </h3>
          <div className="mcc-badges">
            {!readOnly && showXpBadge && mission.xpAwarded && (
              <span className="mcc-xp-badge">+{mission.xpAwarded} XP</span>
            )}
            {!readOnly && isCompletedToday ? (
              <button
                type="button"
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

      {readOnly ? (
        actionSlot
      ) : (
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
      )}
    </div>

    {!readOnly && viewingDetails && (
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

export default MissionCardCondensed;
