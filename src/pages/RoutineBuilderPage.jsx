// src/pages/RoutineBuilderPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutines } from '../contexts/RoutineContext';
import { useMissions } from '../contexts/MissionsContext';
import { getOrCreateDefaultRoutine } from '../services/routineService';
import { DEFAULT_ROUTINE_ID } from '../types/Routine';
import RoutineBuilderSection from '../components/routines/RoutineBuilderSection';
import RoutineBuilderSkeleton from '../components/routines/RoutineBuilderSkeleton';
import ErrorMessage from '../components/ui/ErrorMessage';
import LoadingTransition from '../components/ui/LoadingTransition';
import PageHeader from '../components/ui/PageHeader';
import SuggestedMissionsPicker from '../components/missions/SuggestedMissionsPicker';
import { SUGGESTED_MISSIONS } from '../data/suggestedMissions';
import { createMission } from '../services/missionService';
import { useAndroidBackButton } from '../hooks/useAndroidBackButton';
import './RoutinesPage.css';

// Show only catalog entries that declare a routine context (filters out
// room-bound ones with no routine cadence).
const ROUTINE_SUGGESTIONS = SUGGESTED_MISSIONS.filter(
  s => Array.isArray(s.routineContexts) && s.routineContexts.length > 0
);

// Builder lives on its own page so the today view (/routines) stays a clean
// action surface. Header navigates back to /routines explicitly.
const RoutineBuilderPage = () => {
  const { currentUser } = useAuth();
  const { routineRootSet, refreshRoutines } = useRoutines();
  const {
    missions: cachedMissions,
    isInitialLoading: missionsCacheLoading,
    refresh: refreshMissionsCache,
  } = useMissions();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showSuggestionsPicker, setShowSuggestionsPicker] = useState(false);

  const handleBack = () => navigate('/routines');
  useAndroidBackButton(handleBack);

  // Active missions, derived synchronously from the shared cache.
  const missions = useMemo(() => {
    if (cachedMissions == null) return [];
    return cachedMissions.filter(m => m.status === 'active');
  }, [cachedMissions]);

  const refresh = useCallback(async () => {
    if (!currentUser) return;
    try {
      await Promise.all([
        refreshMissionsCache(),
        refreshRoutines(),
      ]);
    } catch (err) {
      console.error('Routine builder refresh failed:', err);
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
      console.error('Routine builder page load failed:', err);
      setLoadError("Your routine didn't load.");
    } finally {
      setLoading(false);
    }
  }, [currentUser, refreshRoutines]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  const isInitialLoad = loading || missionsCacheLoading;

  return (
    <div className="routines-page">
      <PageHeader
        title="Routine builder"
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
        <LoadingTransition loading={isInitialLoad} skeleton={<RoutineBuilderSkeleton />}>
          <div />
        </LoadingTransition>
      )}

      {!isInitialLoad && !loadError && (
        <>
          <div className="routine-builder-suggestions-row">
            <button
              type="button"
              className="routine-builder-suggestions-btn"
              onClick={() => setShowSuggestionsPicker(true)}
            >
              <span className="material-icons">lightbulb</span>
              Browse suggested missions
            </button>
          </div>
          <RoutineBuilderSection
            missions={missions}
            routineRootSet={routineRootSet}
            routineId={DEFAULT_ROUTINE_ID}
            onSaved={refresh}
          />
        </>
      )}

      <SuggestedMissionsPicker
        open={showSuggestionsPicker}
        onClose={() => setShowSuggestionsPicker(false)}
        title="Routine suggestions"
        subtitle="Pick a few common missions to add to your routine. Skip anything that doesn't fit."
        suggestions={ROUTINE_SUGGESTIONS}
        ctaLabel="Add to routine"
        onAdd={async (selected) => {
          await Promise.all(selected.map(s =>
            createMission(
              currentUser.uid,
              {
                title: s.title,
                description: s.description || '',
                difficulty: s.difficulty,
                dueType: s.dueType,
                skill: s.skill || null,
              },
              { routineId: DEFAULT_ROUTINE_ID }
            )
          ));
          await refresh();
        }}
      />
    </div>
  );
};

export default RoutineBuilderPage;
