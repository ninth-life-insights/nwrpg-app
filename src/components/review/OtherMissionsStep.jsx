// src/components/review/OtherMissionsStep.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMissionCompletion } from '../../contexts/MissionCompletionContext';
import { useMissions } from '../../contexts/MissionsContext';
import { getDailyMissionsConfig } from '../../services/dailyMissionService';
import { toDateString } from '../../utils/dateHelpers';
import MissionCard from '../missions/MissionCard';
import AddMissionCard from '../missions/AddMissionCard';
import ErrorMessage from '../ui/ErrorMessage';
import StickyFooter from '../ui/StickyFooter';
import { isDefinitelyOffline } from '../../utils/fetchWithTimeout';

const FILTERS = ['All', 'Quests', 'Due Today', 'General'];

const OtherMissionsStep = ({
  onToggleComplete,
  onNext,
  onSkipToSummary,
  onAchievementsUnlocked,
}) => {
  const { currentUser } = useAuth();
  const { completeMission: completeMissionOptimistic } = useMissionCompletion();
  const {
    missions: cachedMissions,
    isInitialLoading: missionsCacheLoading,
    refresh: refreshMissionsCache,
  } = useMissions();
  const [dailyConfigIds, setDailyConfigIds] = useState(null); // null = not yet loaded
  const [loadError, setLoadError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showAddMission, setShowAddMission] = useState(false);

  const today = toDateString(new Date());

  // Daily mission IDs are needed to filter out things already in the daily
  // priorities. The config doc is small and stable; fetch it once.
  useEffect(() => {
    if (!currentUser) return;
    if (isDefinitelyOffline()) {
      setLoadError("Your missions didn't load. Check your connection and try again.");
      return;
    }
    setLoadError(null);
    getDailyMissionsConfig(currentUser.uid).then((config) => {
      const ids = config?.setForDate === today ? (config?.missionIds ?? []) : [];
      setDailyConfigIds(new Set(ids));
    }).catch((err) => {
      console.error('Error loading daily config:', err);
      setDailyConfigIds(new Set());
    });
  }, [currentUser, today]);

  // Synchronous derive: today's completed missions + active missions not
  // already on the daily priority list. Re-runs whenever the shared cache
  // updates so completions land here without a refetch.
  const missions = useMemo(() => {
    if (cachedMissions == null || dailyConfigIds == null) return [];
    const activeMissions = cachedMissions.filter(
      m => m.status === 'active' && !dailyConfigIds.has(m.id)
    );
    const completedToday = cachedMissions.filter(m => {
      if (m.status !== 'completed') return false;
      if (!m.completedAt?.toDate) return false;
      return toDateString(m.completedAt.toDate()) === today;
    });
    return [...completedToday, ...activeMissions];
  }, [cachedMissions, dailyConfigIds, today]);

  const loading = missionsCacheLoading || dailyConfigIds == null;

  const handleToggle = async (missionId, isCurrentlyCompleted, xpReward) => {
    try {
      const result = await onToggleComplete(missionId, isCurrentlyCompleted, xpReward);
      // Level-up / skill-up modals fire globally from NotificationContext.
      // Only achievements still need a local hook for the toast.
      if (result?.newlyAwardedAchievements?.length > 0) {
        onAchievementsUnlocked?.(result.newlyAwardedAchievements);
      }
    } catch (err) {
      console.error('Error toggling mission:', err);
    }
  };

  // Called by AddMissionCard after it creates the mission. The mission is
  // immediately auto-completed; route through the optimistic context so the
  // double-tap guard, error rollback, and global level-up modal all apply.
  const handleMissionAdded = async (newMission) => {
    setShowAddMission(false);
    // Make sure the new mission is in the shared cache before completion
    // mutations can touch it.
    await refreshMissionsCache();
    await completeMissionOptimistic(newMission.id, newMission, {
      onAchievementsResolved: (achievements) => onAchievementsUnlocked?.(achievements),
    });
  };

  const filteredMissions = missions.filter(m => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Quests') return !!m.questId;
    if (activeFilter === 'Due Today') return m.dueDate === today;
    if (activeFilter === 'General') return !m.questId && !m.dueDate;
    return true;
  });

  return (
    <div className="review-step">
      <div className="review-step-body">
        <h2 className="review-step-heading">Anything else you tackled?</h2>
        <p className="review-step-subtext">
          Take credit for what you got done, even if it wasn't in the plan.
        </p>

        <div className="review-filter-tabs">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`review-filter-tab ${activeFilter === f ? 'review-filter-tab--active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Log button always visible above the list */}
        {!showAddMission && (
          <button
            className="review-add-mission-link"
            onClick={() => setShowAddMission(true)}
          >
            + Log a mission not in the system
          </button>
        )}

        {/* Scrollable mission list */}
        {loadError ? (
          <ErrorMessage message={loadError} onRetry={refreshMissionsCache} />
        ) : loading ? (
          <p className="review-step-loading">Loading missions...</p>
        ) : (
          <div className="review-missions-scroll">
            {filteredMissions.length === 0 ? (
              <p className="review-step-empty">
                {missions.length === 0
                  ? "Looks like everything's been logged — nice work."
                  : 'No missions match this filter.'}
              </p>
            ) : (
              <div className="review-missions-list">
                {filteredMissions.map(mission => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    onToggleComplete={handleToggle}
                    onMissionChanged={refreshMissionsCache}
                    hideDailyBadge={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* AddMissionCard uses its own overlay — render outside step-body */}
      {showAddMission && (
        <AddMissionCard
          onAddMission={handleMissionAdded}
          onCancel={() => setShowAddMission(false)}
        />
      )}

      <StickyFooter>
        <button className="review-next-btn" onClick={onNext}>
          Next →
        </button>
        <button className="review-skip-link" onClick={onSkipToSummary}>
          Just show me my summary
        </button>
      </StickyFooter>
    </div>
  );
};

export default OtherMissionsStep;
