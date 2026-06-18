// src/pages/RoutineWeekViewPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutines } from '../contexts/RoutineContext';
import { useMissions } from '../contexts/MissionsContext';
import { getUserProfile } from '../services/userService';
import RoutineWeekGrid from '../components/routines/RoutineWeekGrid';
import RoutineGridSkeleton from '../components/routines/RoutineGridSkeleton';
import ErrorMessage from '../components/ui/ErrorMessage';
import LoadingTransition from '../components/ui/LoadingTransition';
import PageHeader from '../components/ui/PageHeader';
import { useAndroidBackButton } from '../hooks/useAndroidBackButton';
import './RoutinesPage.css';

// Pattern-bound workload view: 7 columns ordered by the user's preferred
// week start, each holding weekly-pattern routine tasks. Read-only in Phase 1
// — drag-to-reorganize lands in Phase 2.
const RoutineWeekViewPage = () => {
  const { currentUser } = useAuth();
  const { routineRootSet, pausedRootSet } = useRoutines();
  const {
    missions: cachedMissions,
    isInitialLoading: missionsCacheLoading,
    refresh: refreshMissionsCache,
  } = useMissions();
  const navigate = useNavigate();

  // Default to Monday until the profile loads — matches the seed value and
  // avoids a flash of misordered columns.
  const [weekStartDay, setWeekStartDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const handleBack = () => navigate('/routine-builder');
  useAndroidBackButton(handleBack);

  // Active missions, derived synchronously from the shared cache.
  const missions = useMemo(() => {
    if (cachedMissions == null) return [];
    return cachedMissions.filter(m => m.status === 'active');
  }, [cachedMissions]);

  const initialLoad = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(null);
    try {
      const profile = await getUserProfile(currentUser.uid);
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

  const isInitialLoad = loading || missionsCacheLoading;

  return (
    <div className="routines-page routine-week-view-page">
      <PageHeader
        title="Week view"
        onBack={handleBack}
      />

      {loadError && (
        <ErrorMessage
          message={loadError}
          onRetry={initialLoad}
          className="routines-load-error"
        />
      )}

      {isInitialLoad && !loadError && (
        <LoadingTransition loading={isInitialLoad} skeleton={<RoutineGridSkeleton rows={1} />}>
          <div />
        </LoadingTransition>
      )}

      {!isInitialLoad && !loadError && (
        <RoutineWeekGrid
          missions={missions}
          routineRootSet={routineRootSet}
          pausedRootSet={pausedRootSet}
          weekStartDay={weekStartDay}
          onMutated={refreshMissionsCache}
        />
      )}
    </div>
  );
};

export default RoutineWeekViewPage;
