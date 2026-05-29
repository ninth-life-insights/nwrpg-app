// src/pages/RoutinesPage.jsx
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

const RoutinesPage = () => {
  const { currentUser } = useAuth();
  const { routineRootSet, refreshRoutines } = useRoutines();
  const navigate = useNavigate();

  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadPage = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(null);
    try {
      // Lazy-create the default routine on first visit. Idempotent — no-op
      // when the doc already exists.
      await getOrCreateDefaultRoutine(currentUser.uid);
      const activeMissions = await getActiveMissions(currentUser.uid);
      setMissions(activeMissions);
      await refreshRoutines();
    } catch (err) {
      console.error('Routines page load failed:', err);
      setLoadError("Your routine didn't load.");
    } finally {
      setLoading(false);
    }
  }, [currentUser, refreshRoutines]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

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
        <div className="routines-header-spacer" />
      </div>

      {loadError && (
        <ErrorMessage
          message={loadError}
          onRetry={loadPage}
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
          onSaved={loadPage}
        />
      )}
    </div>
  );
};

export default RoutinesPage;
