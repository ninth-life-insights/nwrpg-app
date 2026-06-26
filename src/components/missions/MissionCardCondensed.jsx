// src/components/missions/MissionCardCondensed.jsx
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import MissionCardFull from './MissionCardFull';
import Badge from '../ui/Badge';
import ErrorMessage from '../ui/ErrorMessage';
import MissionCompletionErrorChip from './MissionCompletionErrorChip';
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
import { useIsDailyMission } from '../../contexts/DailyMissionsContext';
import { useRooms } from '../../contexts/RoomsContext';
import { useRoutines } from '../../contexts/RoutineContext';
import { useMissionCompletion } from '../../contexts/MissionCompletionContext';
import { useTutorial } from '../../contexts/TutorialContext';
import { updateMissionCompletedDate } from '../../services/missionService';
import { isRecurringMission, isEvergreenMission, getRecurrenceDisplayText } from '../../utils/recurrenceHelpers';
import { isMissionInRoutineSet } from '../../utils/routineHelpers';
import { areMissionRendersEqual } from '../../utils/missionHelpers';
import TutorialPlayButton from '../tutorial/TutorialPlayButton';
import dayjs from 'dayjs';
import './MissionCardCondensed.css';

const MissionCardCondensed = ({
  mission,
  onToggleComplete,
  onMissionChanged,
  readOnly = false,
  actionSlot = null,
  hideRecurrenceBadge = false,
  hideRoutineBadge = false,
  hideRoomBadge = false,
  hideEvergreenBadge = true,
  tintEvergreen = false,
  onRecentlyCompletedUpdated = null,
}) => {
  const { currentUser } = useAuth();
  const { roomsMap } = useRooms();
  const { routineRootSet, pausedRootSet } = useRoutines();
  const isDailyMission = useIsDailyMission(mission.id);
  const { isPending, getOptimisticStatus } = useMissionCompletion();
  const { isTutorialMission, openStepForMission } = useTutorial();
  // Tutorial missions get the purple-variant card, a play button instead
  // of the toggle, and body-click opens the overlay (not MissionCardFull).
  // Only kicks in when the caller hasn't already overridden via readOnly /
  // actionSlot (selection surfaces drive their own behavior).
  const isTutorial = isTutorialMission(mission);
  const useTutorialRender = isTutorial && !readOnly && !actionSlot;
  const isCompletionPending = isPending(mission.id);
  const isCompleted = mission.status === MISSION_STATUS.COMPLETED;
  // Optimistic status (when present) wins over cache — see MissionCard for
  // the rationale.
  const optimisticStatus = getOptimisticStatus(mission.id);
  const isVisuallyComplete = optimisticStatus
    ? optimisticStatus === 'completed'
    : isCompleted;
  const missionHasSkill = hasSkill(mission);
  const roomName = mission.baseLocation ? roomsMap[mission.baseLocation]?.name ?? null : null;
  const isRecurring = isRecurringMission(mission);
  const isEvergreen = isEvergreenMission(mission);
  const recurrenceText = getRecurrenceDisplayText(mission);
  const isRoutineMember = isMissionInRoutineSet(mission, routineRootSet);
  const isRoutinePausedMember =
    isRoutineMember &&
    pausedRootSet &&
    pausedRootSet.has(mission.parentMissionId || mission.id);
  const titleRef = useRef(null);
  const [titleMinWidth, setTitleMinWidth] = useState(150);
  const [showXpBadge, setShowXpBadge] = useState(false);
  const [viewingDetails, setViewingDetails] = useState(false);
  const [yesterdayLoading, setYesterdayLoading] = useState(false);
  const [markedYesterday, setMarkedYesterday] = useState(false);
  const [yesterdayError, setYesterdayError] = useState(null);
  // Local override for completedAt so a chip click here is visible to
  // MissionCardFull when the user opens it — without forcing a parent reload.
  const [completedAtOverride, setCompletedAtOverride] = useState(null);

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

  const getDueDateInfo = () => {
    if (!mission.dueDate) return null;
    if (isMissionOverdue(mission)) return { status: 'overdue', display: 'Overdue' };
    if (isMissionDueToday(mission)) return { status: 'today', display: 'Today' };
    if (isMissionDueTomorrow(mission)) return { status: 'tomorrow', display: 'Tomorrow' };
    return { status: 'upcoming', display: formatForUser(mission.dueDate) };
  };

  const dueDateInfo = getDueDateInfo();
  const today = toDateString(new Date());
  // Effective completedAt prefers the local override — see MissionCard for
  // the same reasoning.
  const effectiveCompletedAt = completedAtOverride ?? mission.completedAt;
  const completedDate = isCompleted && effectiveCompletedAt
    ? toDateString(effectiveCompletedAt.toDate?.() ?? new Date(effectiveCompletedAt))
    : null;
  const isCompletedToday = completedDate === today;

  const handleToggleComplete = (e) => {
    e.stopPropagation();
    onToggleComplete(mission.id, isCompleted, mission.xpReward, mission.spReward);
  };

  const handleMarkYesterday = async () => {
    if (yesterdayLoading || markedYesterday || !currentUser) return;
    setYesterdayLoading(true);
    setMarkedYesterday(true);
    setYesterdayError(null);
    try {
      const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
      const result = await updateMissionCompletedDate(currentUser.uid, mission.id, yesterday);
      setCompletedAtOverride(result.completedAt);
      onRecentlyCompletedUpdated?.(mission.id, { completedAt: result.completedAt });
    } catch (err) {
      setMarkedYesterday(false);
      setYesterdayError("That date didn't save.");
    } finally {
      setYesterdayLoading(false);
    }
  };

  // Precedence: completed > daily > priority. (Quest tint isn't applied on the
  // condensed card.) Matches MissionCard's full ordering: daily > priority > quest.
  // Evergreen tint is additive (sits below other priority tints): it's a mission-
  // type cue, opt-in via prop so it only applies on routine surfaces where the
  // evergreen-vs-recurring distinction is meaningful.
  const priorityClass = isDailyMission
    ? 'daily'
    : mission.isPriority ? 'priority' : '';
  const evergreenClass = tintEvergreen && isEvergreen ? 'evergreen' : '';
  const tutorialClass = isTutorial ? 'tutorial' : '';
  const cardClass = readOnly
    ? `mission-card-condensed readonly ${evergreenClass} ${tutorialClass}`.trim()
    : `mission-card-condensed ${isCompleted ? 'completed' : ''} ${priorityClass} ${evergreenClass} ${tutorialClass}`.trim();
  const titleClass = readOnly
    ? 'mcc-title'
    : `mcc-title ${isCompleted ? 'completed' : ''}`;

  return (
  <>
    <div className={cardClass}>
      <div
        className="mcc-content"
        onClick={
          readOnly
            ? undefined
            : useTutorialRender && !isVisuallyComplete
              ? () => openStepForMission(mission, { startFromBeginning: true })
              : useTutorialRender
                ? undefined
                : () => setViewingDetails(true)
        }
        style={readOnly || (useTutorialRender && isVisuallyComplete) ? { cursor: 'default' } : undefined}
      >
        <div className="mcc-row">
          <h3
            ref={titleRef}
            className={titleClass}
            style={{ minWidth: titleMinWidth }}
          >
            {mission.title}
            {mission.isPriority && (
              <span className="material-icons priority-flag" aria-label="Priority mission">flag</span>
            )}
          </h3>
          <div className="mcc-badges">
            {!readOnly && showXpBadge && mission.xpAwarded && (
              <span className="mcc-xp-badge">+{mission.xpAwarded} XP</span>
            )}
            {!readOnly && (isCompletedToday || markedYesterday) ? (
              <button
                type="button"
                className={`mcc-mark-yesterday-chip ${markedYesterday ? 'marked' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleMarkYesterday(); }}
                disabled={yesterdayLoading || markedYesterday}
              >
                {markedYesterday ? 'Moved to yesterday ✓' : 'Did this yesterday?'}
              </button>
            ) : (
              <>
                {isRecurring && !hideRecurrenceBadge && (
                  <Badge variant="recurrence">{recurrenceText}</Badge>
                )}
                {isEvergreen && !hideEvergreenBadge && (
                  <Badge variant="evergreen">Evergreen</Badge>
                )}
                {dueDateInfo && (
                  <Badge variant={`due-${dueDateInfo.status}`}>{dueDateInfo.display}</Badge>
                )}
                {isRoutineMember && !hideRoutineBadge && (
                  isRoutinePausedMember ? (
                    <Badge variant="routine-paused">Routine paused</Badge>
                  ) : (
                    <Badge variant="routine">Routine</Badge>
                  )
                )}
                {roomName && !hideRoomBadge && (
                  <Badge variant="room" icon="home">{roomName}</Badge>
                )}
                <Badge variant="difficulty" difficulty={mission.difficulty}>{mission.difficulty}</Badge>
                {missionHasSkill && (
                  <Badge variant="skill">{mission.skill}</Badge>
                )}
              </>
            )}
            {/* Outside the yesterday-vs-badges branch so it surfaces in
                either state — a failed uncomplete is just as relevant
                when the card is showing "did this yesterday?" as when
                it's showing the normal badge set. */}
            <MissionCompletionErrorChip missionId={mission.id} />
          </div>
        </div>
        {yesterdayError && (
          <div className="mcc-yesterday-error" onClick={(e) => e.stopPropagation()}>
            <ErrorMessage message={yesterdayError} onRetry={handleMarkYesterday} />
          </div>
        )}
      </div>

      {actionSlot ? actionSlot : (
        useTutorialRender && !isVisuallyComplete ? (
          <TutorialPlayButton mission={mission} size="md" />
        ) : !readOnly && (
          <button
            className={`mcc-toggle ${isVisuallyComplete ? 'completed' : ''}`}
            onClick={handleToggleComplete}
            disabled={isCompletionPending}
            aria-label={isVisuallyComplete ? 'Mark as incomplete' : 'Mark as complete'}
          >
            <svg
              className={`mcc-check-icon ${isVisuallyComplete ? 'completed' : ''}`}
              xmlns="http://www.w3.org/2000/svg"
              height="18px"
              viewBox="0 -960 960 960"
              width="18px"
            >
              <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
            </svg>
          </button>
        )
      )}
    </div>

    {!readOnly && viewingDetails && (
      <MissionCardFull
        mission={completedAtOverride
          ? { ...mission, completedAt: completedAtOverride }
          : mission}
        onClose={() => setViewingDetails(false)}
        onToggleComplete={onToggleComplete}
        onMissionChanged={onMissionChanged}
        onCompletedAtChanged={(newTs) => {
          setCompletedAtOverride(newTs);
          onRecentlyCompletedUpdated?.(mission.id, { completedAt: newTs });
        }}
      />
    )}
  </>
  );
};

// Wrapped in React.memo so a sibling re-render in a long list (HomePage
// daily missions, EditDailyMissionsPage bank, routine views) doesn't force
// every other condensed card to re-render. Function props are intentionally
// not compared — treated as stable across renders from the same parent.
export default React.memo(MissionCardCondensed, (prev, next) => {
  if (!areMissionRendersEqual(prev.mission, next.mission)) return false;
  return (
    prev.readOnly === next.readOnly &&
    prev.actionSlot === next.actionSlot &&
    prev.hideRecurrenceBadge === next.hideRecurrenceBadge &&
    prev.hideRoutineBadge === next.hideRoutineBadge &&
    prev.hideRoomBadge === next.hideRoomBadge &&
    prev.hideEvergreenBadge === next.hideEvergreenBadge &&
    prev.tintEvergreen === next.tintEvergreen
  );
});
