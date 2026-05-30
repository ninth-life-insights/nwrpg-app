// src/pages/RoutinesPage.jsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';
import { useRoutines } from '../contexts/RoutineContext';
import { getOrCreateDefaultRoutine } from '../services/routineService';
import {
  getActiveMissions,
  getCompletedMissionsSince,
} from '../services/missionService';
import RoutineTodaySection from '../components/routines/RoutineTodaySection';
import ErrorMessage from '../components/ui/ErrorMessage';
import './RoutinesPage.css';

// /routines is the action surface — today's items only. Builder lives on its
// own page at /routine-builder, accessible via the header manage button.
const RoutinesPage = () => {
  const { currentUser } = useAuth();
  const { routineRootSet, routineOrderMap, refreshRoutines } = useRoutines();
  const navigate = useNavigate();

  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

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

  return (
    <div className="routines-page">
      <div className="routines-page-header">
        <button
          className="routines-home-btn"
          onClick={() => navigate('/home')}
          aria-label="Back to home"
        >
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="routines-page-title">Routines</h1>
        <button
          className="routines-manage-btn"
          onClick={() => navigate('/routine-builder')}
        >
          <span className="material-icons">edit</span>
          Edit routine
        </button>
      </div>

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
        <RoutineTodaySection
          missions={missions}
          routineRootSet={routineRootSet}
          routineOrderMap={routineOrderMap}
          onSaved={refresh}
        />
      )}
    </div>
  );
};

export default RoutinesPage;
