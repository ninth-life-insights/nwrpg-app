// src/components/routines/RoutineUpNextCard.jsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoutines } from '../../contexts/RoutineContext';
import { getRoutineMissionsForDate } from '../../utils/routineHelpers';
import { MISSION_STATUS } from '../../types/Mission';
import './RoutineUpNextCard.css';

// Compact "up next in your routine" affordance for the home page. Lives
// inside the daily-missions section's yellow-bordered card so it reads as
// part of the same today-focused interaction block — secondary to the three
// daily-priority cards above it. Three render states:
//
//   - has-no-routine-yet: tap → /routine-builder, prompts setup
//   - all-clear: tap → /routines, quiet ✓ confirmation
//   - active: shows next incomplete item + "+ N more today" + arrow to /routines
//
// Loading: pass `missions === null` to render a quiet skeleton (so the
// "clear today" copy doesn't flash before data arrives).
const RoutineUpNextCard = ({ missions }) => {
  const navigate = useNavigate();
  const { routineRootSet, routineOrderMap } = useRoutines();

  const loading = missions === null;
  const hasNoRoutineYet = !loading && routineRootSet.size === 0;

  const todayActive = useMemo(() => {
    if (!missions) return [];
    const todayItems = getRoutineMissionsForDate(
      missions,
      routineRootSet,
      undefined,
      routineOrderMap
    );
    return todayItems.filter((m) => m.status === MISSION_STATUS.ACTIVE);
  }, [missions, routineRootSet, routineOrderMap]);

  if (loading) {
    return <div className="routine-up-next routine-up-next--loading" aria-hidden="true" />;
  }

  if (hasNoRoutineYet) {
    return (
      <button
        type="button"
        className="routine-up-next routine-up-next--empty"
        onClick={() => navigate('/routine-builder')}
      >
        <span className="routine-up-next-label">Routine</span>
        <span className="routine-up-next-cta">Set up your rhythm →</span>
      </button>
    );
  }

  if (todayActive.length === 0) {
    return (
      <button
        type="button"
        className="routine-up-next routine-up-next--clear"
        onClick={() => navigate('/routines')}
      >
        <span className="routine-up-next-label">Routine</span>
        <span className="routine-up-next-clear-text">Clear today ✓</span>
      </button>
    );
  }

  const nextUp = todayActive[0];
  const remainingCount = todayActive.length - 1;

  return (
    <button
      type="button"
      className="routine-up-next"
      onClick={() => navigate('/routines')}
      aria-label="View routine"
    >
      <div className="routine-up-next-head">
        <span className="routine-up-next-label">Up next in your routine</span>
        <span className="material-icons routine-up-next-arrow" aria-hidden="true">
          chevron_right
        </span>
      </div>
      <div className="routine-up-next-body">
        <span className="routine-up-next-mission">{nextUp.title}</span>
        {remainingCount > 0 && (
          <span className="routine-up-next-rest">
            +{remainingCount} more today
          </span>
        )}
      </div>
    </button>
  );
};

export default RoutineUpNextCard;
