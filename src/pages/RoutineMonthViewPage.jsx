// src/pages/RoutineMonthViewPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutines } from '../contexts/RoutineContext';
import { useMissions } from '../contexts/MissionsContext';
import { getUserProfile } from '../services/userService';
import RoutineMonthGrid from '../components/routines/RoutineMonthGrid';
import RoutineGridSkeleton from '../components/routines/RoutineGridSkeleton';
import ErrorMessage from '../components/ui/ErrorMessage';
import LoadingTransition from '../components/ui/LoadingTransition';
import PageHeader from '../components/ui/PageHeader';
import { useAndroidBackButton } from '../hooks/useAndroidBackButton';
import './RoutinesPage.css';

// Date-bound calendar view of the user's monthly-pattern routine tasks.
// Navigable across months. Carries the same weekStartDay setting from
// the profile as the week view so weekday columns stay consistent.
const RoutineMonthViewPage = () => {
  const { currentUser } = useAuth();
  const { routineRootSet, pausedRootSet } = useRoutines();
  const {
    missions: cachedMissions,
    isInitialLoading: missionsCacheLoading,
    refresh: refreshMissionsCache,
  } = useMissions();
  const navigate = useNavigate();

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
      console.error('Routine month view load failed:', err);
      setLoadError("Your month view didn't load.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  const isInitialLoad = loading || missionsCacheLoading;

  return (
    <div className="routines-page routine-month-view-page">
      <PageHeader
        title="Month view"
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
        <LoadingTransition loading={isInitialLoad} skeleton={<RoutineGridSkeleton rows={5} />}>
          <div />
        </LoadingTransition>
      )}

      {!isInitialLoad && !loadError && (
        <RoutineMonthGrid
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

export default RoutineMonthViewPage;
