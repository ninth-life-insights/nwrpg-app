// src/components/review/OtherMissionsStep.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveMissions, getCompletedMissions, completeMissionWithRecurrence } from '../../services/missionService';
import { getDailyMissionsConfig } from '../../services/dailyMissionService';
import { getAllQuests } from '../../services/questService';
import { toDateString } from '../../utils/dateHelpers';
import MissionCard from '../missions/MissionCard';
import AddMissionCard from '../missions/AddMissionCard';
import ErrorMessage from '../ui/ErrorMessage';
import StickyFooter from '../ui/StickyFooter';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../../utils/fetchWithTimeout';

const FILTERS = ['All', 'Quests', 'Due Today', 'General'];

const OtherMissionsStep = ({
  onToggleComplete,
  onNext,
  onSkipToSummary,
  setLevelUpInfo,
  setSkillLevelUpInfo,
  onAchievementsUnlocked,
}) => {
  const { currentUser } = useAuth();
  const [missions, setMissions] = useState([]);
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showAddMission, setShowAddMission] = useState(false);

  const today = toDateString(new Date());

  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      setLoading(true);
      setIsLoadingSlow(false);
      if (isDefinitelyOffline()) {
        setLoadError("Your missions didn't load. Check your connection and try again.");
        setLoading(false);
        return;
      }
      const slowTimer = setTimeout(() => setIsLoadingSlow(true), 3000);
      try {
        const [allActive, allCompleted, config, questData] = await withTimeout(
          Promise.all([
            getActiveMissions(currentUser.uid),
            getCompletedMissions(currentUser.uid),
            getDailyMissionsConfig(currentUser.uid),
            getAllQuests(currentUser.uid),
          ])
        );
        const dailyIds = new Set(
          config?.setForDate === today ? (config?.missionIds ?? []) : []
        );
        const activeMissions = allActive.filter(m => !dailyIds.has(m.id));
        const completedToday = allCompleted.filter(m => {
          if (!m.completedAt?.toDate) return false;
          return toDateString(m.completedAt.toDate()) === today;
        });
        setMissions([...completedToday, ...activeMissions]);
        setQuests(questData);
      } catch (err) {
        console.error('Error loading other missions:', err);
        setLoadError(getLoadErrorMessage(err, 'missions'));
      } finally {
        clearTimeout(slowTimer);
        setLoading(false);
        setIsLoadingSlow(false);
      }
    };
    load();
  }, [currentUser, reloadTrigger]);

  const handleToggle = async (missionId, isCurrentlyCompleted, xpReward) => {
    try {
      const result = await onToggleComplete(missionId, isCurrentlyCompleted, xpReward);
      if (result?.leveledUp) setLevelUpInfo({ newLevel: result.newLevel });
      if (result?.skillLeveledUp) setSkillLevelUpInfo({ skillName: result.skillName, newLevel: result.newSkillLevel });
      if (result?.newlyAwardedAchievements?.length > 0) onAchievementsUnlocked?.(result.newlyAwardedAchievements);
      setMissions(prev => prev.map(m =>
        m.id === missionId
          ? { ...m, status: isCurrentlyCompleted ? 'active' : 'completed' }
          : m
      ));
    } catch (err) {
      console.error('Error toggling mission:', err);
    }
  };

  // Called by AddMissionCard after it creates the mission
  const handleMissionAdded = async (newMission) => {
    setShowAddMission(false);
    // Immediately complete it and give credit
    try {
      const result = await completeMissionWithRecurrence(currentUser.uid, newMission.id);
      if (result?.leveledUp) setLevelUpInfo({ newLevel: result.newLevel });
      if (result?.skillLeveledUp) setSkillLevelUpInfo({ skillName: result.skillName, newLevel: result.newSkillLevel });
      if (result?.newlyAwardedAchievements?.length > 0) onAchievementsUnlocked?.(result.newlyAwardedAchievements);
      setMissions(prev => [{ ...newMission, status: 'completed' }, ...prev]);
    } catch (err) {
      console.error('Error completing new mission:', err);
      setMissions(prev => [...prev, newMission]);
    }
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
          <ErrorMessage message={loadError} onRetry={() => { setLoadError(null); setReloadTrigger(t => t + 1); }} />
        ) : loading ? (
          <p className="review-step-loading">
            Loading missions...
            {isLoadingSlow && <span className="loading-slow-hint"> Still searching the realm...</span>}
          </p>
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
                    onViewDetails={() => {}}
                    hideDailyBadge={true}
                    quest={quests.find(q => q.id === mission.questId) ?? null}
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
