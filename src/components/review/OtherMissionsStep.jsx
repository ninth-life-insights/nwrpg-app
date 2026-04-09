// src/components/review/OtherMissionsStep.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveMissions, completeMissionWithRecurrence } from '../../services/missionService';
import { getDailyMissionsConfig } from '../../services/dailyMissionService';
import { toDateString } from '../../utils/dateHelpers';
import MissionCard from '../missions/MissionCard';
import AddMissionCard from '../missions/AddMissionCard';

const FILTERS = ['All', 'Quests', 'Due Today', 'General'];

const OtherMissionsStep = ({
  onToggleComplete,
  onNext,
  onBack,
  onSkipToSummary,
  setLevelUpInfo,
  setSkillLevelUpInfo,
}) => {
  const { currentUser } = useAuth();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showAddMission, setShowAddMission] = useState(false);

  const today = toDateString(new Date());

  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        const [allActive, config] = await Promise.all([
          getActiveMissions(currentUser.uid),
          getDailyMissionsConfig(currentUser.uid),
        ]);
        const dailyIds = new Set(
          config?.setForDate === today ? (config?.missionIds ?? []) : []
        );
        setMissions(allActive.filter(m => !dailyIds.has(m.id)));
      } catch (err) {
        console.error('Error loading other missions:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  const handleToggle = async (missionId, isCurrentlyCompleted, xpReward) => {
    try {
      const result = await onToggleComplete(missionId, isCurrentlyCompleted, xpReward);
      if (result?.leveledUp) setLevelUpInfo({ newLevel: result.newLevel });
      if (result?.skillLeveledUp) setSkillLevelUpInfo({ skillName: result.skillName, newLevel: result.newSkillLevel });
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
      setMissions(prev => [...prev, { ...newMission, status: 'completed' }]);
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
        {loading ? (
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
                    onViewDetails={() => {}}
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

      <div className="review-step-footer">
        <button className="review-next-btn" onClick={onNext}>
          Next →
        </button>
        <button className="review-skip-link" onClick={onSkipToSummary}>
          Just show me my summary
        </button>
      </div>
    </div>
  );
};

export default OtherMissionsStep;
