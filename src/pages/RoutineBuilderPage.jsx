// src/pages/RoutineBuilderPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTutorial } from '../contexts/TutorialContext';
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
import { SUGGESTED_MISSIONS, ROUTINE_CONTEXTS } from '../data/suggestedMissions';
import { createMission } from '../services/missionService';
import { useAndroidBackButton } from '../hooks/useAndroidBackButton';
import './RoutinesPage.css';

// Show only catalog entries that declare a routine context (filters out
// room-bound ones with no routine cadence).
const ROUTINE_SUGGESTIONS = SUGGESTED_MISSIONS.filter(
  s => Array.isArray(s.routineContexts) && s.routineContexts.length > 0
);

const ROUTINE_FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: ROUTINE_CONTEXTS.MORNING,  label: 'Morning',
    predicate: s => s.routineContexts?.includes(ROUTINE_CONTEXTS.MORNING) },
  { key: ROUTINE_CONTEXTS.EVENING,  label: 'Evening',
    predicate: s => s.routineContexts?.includes(ROUTINE_CONTEXTS.EVENING) },
  { key: ROUTINE_CONTEXTS.BEDTIME,  label: 'Bedtime',
    predicate: s => s.routineContexts?.includes(ROUTINE_CONTEXTS.BEDTIME) },
  { key: ROUTINE_CONTEXTS.WEEKDAY,  label: 'Weekday',
    predicate: s => s.routineContexts?.includes(ROUTINE_CONTEXTS.WEEKDAY) },
  { key: ROUTINE_CONTEXTS.WEEKEND,  label: 'Weekend',
    predicate: s => s.routineContexts?.includes(ROUTINE_CONTEXTS.WEEKEND) },
];

// Builder lives on its own page so the today view (/routines) stays a clean
// action surface. Header navigates back to /routines explicitly.
const RoutineBuilderPage = () => {
  const { currentUser } = useAuth();
  const { triggerStep } = useTutorial();
  // The home-page "routines" link skips /routines for users who haven't
  // initialized a routine yet — it lands them directly on /routine-builder.
  // Auto-fire from both pages so the tutorial step doesn't miss either path.
  useEffect(() => {
    triggerStep('routine');
    return () => triggerStep(null);
  }, [triggerStep]);
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
        filterOptions={ROUTINE_FILTER_OPTIONS}
        initialFilterKey="all"
        ctaLabel="Add to routine"
        onAdd={async (selected) => {
          // Sequential creates — addMissionToRoutine updates the same routine
          // doc on each call, so parallel writes can race and drop entries.
          // Preserve each suggestion's natural cadence: clean-out-fridge stays
          // monthly, vacuum stays weekly, make-bed stays daily. Evergreen
          // suggestions (run a load of laundry, restock TP) stay evergreen.
          for (const s of selected) {
            await createMission(
              currentUser.uid,
              {
                title: s.title,
                description: s.description || '',
                difficulty: s.difficulty,
                dueType: s.dueType,
                recurrence: s.recurrence
                  ? { pattern: s.recurrence.pattern, interval: s.recurrence.interval, weekdays: [] }
                  : undefined,
                skill: s.skill || null,
              },
              { routineId: DEFAULT_ROUTINE_ID }
            );
          }
          await refresh();
        }}
      />
    </div>
  );
};

export default RoutineBuilderPage;
