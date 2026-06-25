// src/components/routines/RoutineUpNextCard.jsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMissionCompletion } from '../../contexts/MissionCompletionContext';
import { useRoutines } from '../../contexts/RoutineContext';
import { useDailyMissions } from '../../contexts/DailyMissionsContext';
import { isRoutinePaused } from '../../services/routineService';
import { getRoutineMissionsForDate } from '../../utils/routineHelpers';
import { fromDateString } from '../../utils/dateHelpers';
import { MISSION_STATUS } from '../../types/Mission';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import './RoutineUpNextCard.css';

// "Next up in your routine" preview on the home page. Sits BELOW the
// Quests / Mission Bank action tiles inside the same daily-missions card,
// mirroring the way QuestCard shows its next mission: small "Next up" label
// then a real condensed mission card she can act on directly. Tapping the
// toggle completes the routine task with normal recurrence + notification
// behavior. The label is also a tap target → /routines for the full view.
//
// Routine items already on the daily-priority list are filtered out so the
// home page doesn't show the same task twice — the routine card surfaces
// the next routine thing she hasn't already planned.
const RoutineUpNextCard = ({ missions, onMissionChanged }) => {
  const {
    completeMission: completeMissionOptimistic,
    uncompleteMission: uncompleteMissionOptimistic,
  } = useMissionCompletion();
  const { routines, routineRootSet, routineOrderMap, pausedRootSet, cadenceByChainRoot } = useRoutines();
  const { dailyMissionIds } = useDailyMissions();
  const navigate = useNavigate();

  const loading = missions === null;
  const hasNoRoutineYet = !loading && routineRootSet.size === 0;

  // First paused routine (v1 has a single default routine, so this is "the"
  // routine if it's paused). Drives the paused-state render branch.
  const pausedRoutine = useMemo(
    () => routines.find((r) => isRoutinePaused(r)) || null,
    [routines]
  );

  const todayActive = useMemo(() => {
    if (!missions) return [];
    const items = getRoutineMissionsForDate(
      missions,
      routineRootSet,
      undefined,
      routineOrderMap,
      pausedRootSet,
      cadenceByChainRoot
    );
    return items.filter((m) => m.status === MISSION_STATUS.ACTIVE);
  }, [missions, routineRootSet, routineOrderMap, pausedRootSet, cadenceByChainRoot]);

  // Items not already promoted to today's daily priorities — those would
  // otherwise render as duplicates of the cards above.
  const todayActiveNotInDaily = useMemo(
    () => todayActive.filter((m) => !dailyMissionIds.has(m.id)),
    [todayActive, dailyMissionIds]
  );

  const handleToggleComplete = async (missionId, isCurrentlyCompleted) => {
    if (isCurrentlyCompleted) {
      uncompleteMissionOptimistic(missionId, {
        onResolved: () => onMissionChanged?.(),
      });
      return;
    }

    const mission = (missions || []).find((m) => m.id === missionId);
    completeMissionOptimistic(missionId, mission, {
      // No local missions state to flip — parent owns the list and refreshes
      // via onMissionChanged. The card itself shows the optimistic check via
      // the context selector in MissionCardCondensed.
      onResolved: () => onMissionChanged?.(),
    });
  };

  if (loading) {
    return <div className="routine-up-next routine-up-next--loading" aria-hidden="true" />;
  }

  if (pausedRoutine) {
    const resumeLabel = fromDateString(pausedRoutine.pausedUntil).format('ddd, MMM D');
    return (
      <button
        type="button"
        className="routine-up-next-link"
        onClick={() => navigate('/routines')}
      >
        <span
          className="material-icons routine-up-next-link-leading-icon"
          aria-hidden="true"
        >
          pause_circle
        </span>
        <span className="routine-up-next-link-label">
          Routine paused until {resumeLabel}
        </span>
        <span className="material-icons routine-up-next-link-arrow" aria-hidden="true">
          chevron_right
        </span>
      </button>
    );
  }

  if (hasNoRoutineYet) {
    return (
      <button
        type="button"
        className="routine-up-next-link"
        onClick={() => navigate('/routine-builder')}
      >
        <span className="routine-up-next-link-label">Set up your routine</span>
        <span className="material-icons routine-up-next-link-arrow" aria-hidden="true">
          chevron_right
        </span>
      </button>
    );
  }

  if (todayActive.length === 0) {
    return (
      <button
        type="button"
        className="routine-up-next-link"
        onClick={() => navigate('/routines')}
      >
        <span className="routine-up-next-link-label">Routine clear today ✓</span>
        <span className="material-icons routine-up-next-link-arrow" aria-hidden="true">
          chevron_right
        </span>
      </button>
    );
  }

  // Routine items exist today, but she's already promoted all of them to her
  // daily priorities — they render in the list above, so this slot collapses
  // to a quieter confirmation instead of duplicating a card.
  if (todayActiveNotInDaily.length === 0) {
    return (
      <button
        type="button"
        className="routine-up-next-link"
        onClick={() => navigate('/routines')}
      >
        <span className="routine-up-next-link-label">
          Today's routine is on your priority list ✓
        </span>
        <span className="material-icons routine-up-next-link-arrow" aria-hidden="true">
          chevron_right
        </span>
      </button>
    );
  }

  const nextUp = todayActiveNotInDaily[0];
  // Count reflects the full routine workload today, not just the non-daily
  // subset — so the number reads as "how much routine is on your plate today"
  // regardless of how much she's already promoted to daily priorities.
  const remainingCount = todayActive.length - 1;

  return (
    <div className="routine-up-next">
      <button
        type="button"
        className="routine-up-next-header"
        onClick={() => navigate('/routines')}
      >
        <span className="routine-up-next-label">Today's Routine</span>
        <span className="routine-up-next-header-end">
          {remainingCount > 0 && (
            <span className="routine-up-next-more">+{remainingCount} more</span>
          )}
          <span className="material-icons routine-up-next-arrow" aria-hidden="true">
            chevron_right
          </span>
        </span>
      </button>
      <MissionCardCondensed
        mission={nextUp}
        hideRecurrenceBadge
        hideRoutineBadge
        hideEvergreenBadge={false}
        tintEvergreen
        onToggleComplete={handleToggleComplete}
        onMissionChanged={onMissionChanged}
      />
    </div>
  );
};

export default RoutineUpNextCard;
