// src/pages/RoutineMonthViewPage.jsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutines } from '../contexts/RoutineContext';
import { getActiveMissions } from '../services/missionService';
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
  const navigate = useNavigate();

  const [missions, setMissions] = useState([]);
  const [weekStartDay, setWeekStartDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const handleBack = () => navigate('/routine-builder');
  useAndroidBackButton(handleBack);

  const refreshMissions = useCallback(async () => {
    if (!currentUser) return;
    try {
      const activeMissions = await getActiveMissions(currentUser.uid);
      setMissions(activeMissions);
    } catch (err) {
      console.error('Routine month view refresh failed:', err);
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
      console.error('Routine month view load failed:', err);
      setLoadError("Your month view didn't load.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

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

      {loading && !loadError && (
        <LoadingTransition loading={loading} skeleton={<RoutineGridSkeleton rows={5} />}>
          <div />
        </LoadingTransition>
      )}

      {!loading && !loadError && (
        <RoutineMonthGrid
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

export default RoutineMonthViewPage;
