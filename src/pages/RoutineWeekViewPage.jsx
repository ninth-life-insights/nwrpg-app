// src/pages/RoutineWeekViewPage.jsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutines } from '../contexts/RoutineContext';
import { getActiveMissions } from '../services/missionService';
import { getUserProfile } from '../services/userService';
import RoutineWeekGrid from '../components/routines/RoutineWeekGrid';
import ErrorMessage from '../components/ui/ErrorMessage';
import PageHeader from '../components/ui/PageHeader';
import './RoutinesPage.css';

// Pattern-bound workload view: 7 columns ordered by the user's preferred
// week start, each holding weekly-pattern routine tasks. Read-only in Phase 1
// — drag-to-reorganize lands in Phase 2.
const RoutineWeekViewPage = () => {
  const { currentUser } = useAuth();
  const { routineRootSet, pausedRootSet } = useRoutines();
  const navigate = useNavigate();

  const [missions, setMissions] = useState([]);
  // Default to Monday until the profile loads — matches the seed value and
  // avoids a flash of misordered columns.
  const [weekStartDay, setWeekStartDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Lightweight refresh — re-pulls active missions after a drag mutation
  // without re-fetching the profile (weekStartDay doesn't change here).
  const refreshMissions = useCallback(async () => {
    if (!currentUser) return;
    try {
      const activeMissions = await getActiveMissions(currentUser.uid);
      setMissions(activeMissions);
    } catch (err) {
      console.error('Routine week view refresh failed:', err);
    }
  }, [currentUser]);

  const initialLoad = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [activeMissions, profile] = await Promise.all([
        getActiveMissions(currentUser.uid),
        getUserProfile(currentUser.uid),
      ]);
      setMissions(activeMissions);
      if (profile && typeof profile.weekStartDay === 'number') {
        setWeekStartDay(profile.weekStartDay);
      }
    } catch (err) {
      console.error('Routine week view load failed:', err);
      setLoadError("Your week view didn't load.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  return (
    <div className="routines-page routine-week-view-page">
      <PageHeader
        title="Week view"
        onBack={() => navigate('/routine-builder')}
      />

      {loadError && (
        <ErrorMessage
          message={loadError}
          onRetry={initialLoad}
          className="routines-load-error"
        />
      )}

      {loading && !loadError && (
        <div className="routines-loading">Loading…</div>
      )}

      {!loading && !loadError && (
        <RoutineWeekGrid
          missions={missions}
          routineRootSet={routineRootSet}
          pausedRootSet={pausedRootSet}
          weekStartDay={weekStartDay}
          onMutated={refreshMissions}
        />
      )}
    </div>
  );
};

export default RoutineWeekViewPage;
