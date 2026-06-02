// src/pages/RoutinesPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';
import { useRoutines } from '../contexts/RoutineContext';
import {
  getOrCreateDefaultRoutine,
  isRoutinePaused,
} from '../services/routineService';
import { DEFAULT_ROUTINE_ID } from '../types/Routine';
import {
  getActiveMissions,
  getCompletedMissionsSince,
} from '../services/missionService';
import RoutineTodaySection from '../components/routines/RoutineTodaySection';
import PauseRoutineDialog from '../components/routines/PauseRoutineDialog';
import ErrorMessage from '../components/ui/ErrorMessage';
import PageHeader from '../components/ui/PageHeader';
import StickyFooter from '../components/ui/StickyFooter';
import './RoutinesPage.css';

// /routines is the action surface — today's items only. Builder lives on its
// own page at /routine-builder, accessible via the prominent primary CTA.
// Pause sits in the page header as a small icon-and-label action so it's
// always discoverable on first load.
const RoutinesPage = () => {
  const { currentUser } = useAuth();
  const { routines, routineRootSet, routineOrderMap, refreshRoutines } = useRoutines();
  const navigate = useNavigate();

  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseDialogInitial, setPauseDialogInitial] = useState(null);

  // Pause state for the default routine — drives header action visibility
  // and the today section's paused-state branch.
  const defaultRoutine = useMemo(
    () => routines.find((r) => r.id === DEFAULT_ROUTINE_ID) || null,
    [routines]
  );
  const paused = !!defaultRoutine && isRoutinePaused(defaultRoutine);

  const refresh = useCallback(async () => {
    if (!currentUser) return;
    try {
      // Fetch active + today's completed in parallel so the today view can
      // show completed items alongside active ones (progress-through-the-day
      // pattern, not a vanishing checklist).
      const startOfToday = dayjs().startOf('day').toDate();
      const [activeMissions, completedToday] = await Promise.all([
        getActiveMissions(currentUser.uid),
        getCompletedMissionsSince(currentUser.uid, startOfToday),
      ]);
      setMissions([...activeMissions, ...completedToday]);
      await refreshRoutines();
    } catch (err) {
      console.error('Routines refresh failed:', err);
    }
  }, [currentUser, refreshRoutines]);

  const initialLoad = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(null);
    try {
      await getOrCreateDefaultRoutine(currentUser.uid);
      await refresh();
    } catch (err) {
      console.error('Routines page load failed:', err);
      setLoadError("Your routine didn't load.");
    } finally {
      setLoading(false);
    }
  }, [currentUser, refresh]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  const openPauseDialog = (initial = null) => {
    setPauseDialogInitial(initial);
    setShowPauseDialog(true);
  };

  return (
    <div className="routines-page">
      <PageHeader
        title="Routines"
        onBack={() => navigate('/home')}
        action={
          !paused && !loading && (
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

      {loading && !loadError && (
        <div className="routines-loading">Loading…</div>
      )}

      {!loading && !loadError && (
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
