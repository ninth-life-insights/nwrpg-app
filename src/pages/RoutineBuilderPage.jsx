// src/pages/RoutineBuilderPage.jsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutines } from '../contexts/RoutineContext';
import { getOrCreateDefaultRoutine } from '../services/routineService';
import { getActiveMissions } from '../services/missionService';
import { DEFAULT_ROUTINE_ID } from '../types/Routine';
import RoutineBuilderSection from '../components/routines/RoutineBuilderSection';
import ErrorMessage from '../components/ui/ErrorMessage';
import './RoutinesPage.css';

// Builder lives on its own page so the today view (/routines) stays a clean
// action surface. Header navigates back to /routines explicitly.
const RoutineBuilderPage = () => {
  const { currentUser } = useAuth();
  const { routineRootSet, refreshRoutines } = useRoutines();
  const navigate = useNavigate();

  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const refresh = useCallback(async () => {
    if (!currentUser) return;
    try {
      const activeMissions = await getActiveMissions(currentUser.uid);
      setMissions(activeMissions);
      await refreshRoutines();
    } catch (err) {
      console.error('Routine builder refresh failed:', err);
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
      console.error('Routine builder page load failed:', err);
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
          onClick={() => navigate('/routines')}
          aria-label="Back to today"
        >
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="routines-page-title">Routine builder</h1>
        <div className="routines-header-spacer" />
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
        <RoutineBuilderSection
          missions={missions}
          routineRootSet={routineRootSet}
          routineId={DEFAULT_ROUTINE_ID}
          onSaved={refresh}
        />
      )}
    </div>
  );
};

export default RoutineBuilderPage;
