// src/pages/RoutinesPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';
import { useRoutines } from '../contexts/RoutineContext';
import { useMissions } from '../contexts/MissionsContext';
import {
  getOrCreateDefaultRoutine,
  isRoutinePaused,
} from '../services/routineService';
import { DEFAULT_ROUTINE_ID } from '../types/Routine';
import RoutineTodaySection from '../components/routines/RoutineTodaySection';
import RoutineTodaySkeleton from '../components/routines/RoutineTodaySkeleton';
import PauseRoutineDialog from '../components/routines/PauseRoutineDialog';
import ErrorMessage from '../components/ui/ErrorMessage';
import LoadingTransition from '../components/ui/LoadingTransition';
import PageHeader from '../components/ui/PageHeader';
import StickyFooter from '../components/ui/StickyFooter';
import { useAndroidBackButton } from '../hooks/useAndroidBackButton';
import './RoutinesPage.css';

// /routines is the action surface — today's items only. Builder lives on its
// own page at /routine-builder, accessible via the prominent primary CTA.
// Pause sits in the page header as a small icon-and-label action so it's
// always discoverable on first load.
const RoutinesPage = () => {
  const { currentUser } = useAuth();
  const { routines, routineRootSet, routineOrderMap, refreshRoutines } = useRoutines();
  const {
    missions: cachedMissions,
    isInitialLoading: missionsCacheLoading,
    refresh: refreshMissionsCache,
  } = useMissions();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseDialogInitial, setPauseDialogInitial] = useState(null);

  const handleBack = () => navigate('/home');
  useAndroidBackButton(handleBack);

  // Pause state for the default routine — drives header action visibility
  // and the today section's paused-state branch.
  const defaultRoutine = useMemo(
    () => routines.find((r) => r.id === DEFAULT_ROUTINE_ID) || null,
    [routines]
  );
  const paused = !!defaultRoutine && isRoutinePaused(defaultRoutine);

  // Active + today's completed missions, derived synchronously from the
  // shared cache. Today view shows completed items alongside active ones
  // (progress-through-the-day pattern, not a vanishing checklist).
  const missions = useMemo(() => {
    if (cachedMissions == null) return [];
    const startOfToday = dayjs().startOf('day').toDate();
    const active = cachedMissions.filter(m => m.status === 'active');
    const completedToday = cachedMissions.filter(m => {
      if (m.status !== 'completed') return false;
      if (!m.completedAt) return false;
      const completedAt = m.completedAt.toDate
        ? m.completedAt.toDate()
        : new Date(m.completedAt);
      return completedAt >= startOfToday;
    });
    return [...active, ...completedToday];
  }, [cachedMissions]);

  // Called after any in-page mutation that needs fresh data (pause/resume,
  // bucket skip, completion toggle from within the today section).
  const refresh = useCallback(async () => {
    if (!currentUser) return;
    try {
      await Promise.all([
        refreshMissionsCache(),
        refreshRoutines(),
      ]);
    } catch (err) {
      console.error('Routines refresh failed:', err);
    }
  }, [currentUser, refreshMissionsCache, refreshRoutines]);

  const initialLoad = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(null);
    try {
      await getOrCreateDefaultRoutine(currentUser.uid);
      await refreshRoutines();
    } catch (err) {
      console.error('Routines page load failed:', err);
      setLoadError("Your routine didn't load.");
    } finally {
      setLoading(false);
    }
  }, [currentUser, refreshRoutines]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  const openPauseDialog = (initial = null) => {
    setPauseDialogInitial(initial);
    setShowPauseDialog(true);
  };

  const isInitialLoad = loading || missionsCacheLoading;

  return (
    <div className="routines-page">
      <PageHeader
        title="Routines"
        onBack={handleBack}
        action={
          !paused && !isInitialLoad && (
            <button
              type="button"
              className="routines-pause-btn"
              onClick={() => openPauseDialog(null)}
            >
              <span className="material-icons">pause_circle</span>
              Pause
            </button>
          )
        }
      />

      {loadError && (
        <ErrorMessage
          message={loadError}
          onRetry={initialLoad}
          className="routines-load-error"
        />
      )}

      {isInitialLoad && !loadError && (
        <LoadingTransition loading={isInitialLoad} skeleton={<RoutineTodaySkeleton />}>
          <div />
        </LoadingTransition>
      )}

      {!isInitialLoad && !loadError && (
        <>
          <RoutineTodaySection
            missions={missions}
            routineRootSet={routineRootSet}
            routineOrderMap={routineOrderMap}
            routineId={DEFAULT_ROUTINE_ID}
            onOpenPauseDialog={openPauseDialog}
            onSaved={refresh}
          />

          <StickyFooter bgColor="var(--color-bg-secondary)">
            <button
              type="button"
              className="routines-open-builder-btn"
              onClick={() => navigate('/routine-builder')}
            >
              <span className="material-icons">build</span>
              Open Routine Builder
            </button>
          </StickyFooter>
        </>
      )}

      {showPauseDialog && (
        <PauseRoutineDialog
          routineId={DEFAULT_ROUTINE_ID}
          initialDate={pauseDialogInitial}
          onClose={() => setShowPauseDialog(false)}
          onPaused={refresh}
        />
      )}
    </div>
  );
};

export default RoutinesPage;
