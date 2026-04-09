// src/components/review/OtherMissionsStep.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveMissions, createMission, completeMissionWithRecurrence } from '../../services/missionService';
import { getDailyMissionsConfig } from '../../services/dailyMissionService';
import { toDateString } from '../../utils/dateHelpers';
import { DIFFICULTY_LEVELS } from '../../types/Mission';
import MissionCard from '../missions/MissionCard';

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

  // Inline new mission form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDifficulty, setNewDifficulty] = useState(DIFFICULTY_LEVELS.EASY);
  const [addingMission, setAddingMission] = useState(false);

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

        // Exclude missions already in the daily set for today
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

      // Update local list to reflect new status
      setMissions(prev => prev.map(m =>
        m.id === missionId
          ? { ...m, status: isCurrentlyCompleted ? 'active' : 'completed' }
          : m
      ));
    } catch (err) {
      console.error('Error toggling mission:', err);
    }
  };

  const handleAddMission = async () => {
    if (!newTitle.trim() || addingMission) return;
    setAddingMission(true);
    try {
      const missionId = await createMission(currentUser.uid, {
        title: newTitle.trim(),
        difficulty: newDifficulty,
        description: '',
        skill: null,
      });
      // Immediately complete it
      const result = await completeMissionWithRecurrence(currentUser.uid, missionId);
      if (result?.leveledUp) setLevelUpInfo({ newLevel: result.newLevel });
      if (result?.skillLeveledUp) setSkillLevelUpInfo({ skillName: result.skillName, newLevel: result.newSkillLevel });

      // Add to local list as completed so it's visible
      setMissions(prev => [...prev, {
        id: missionId,
        title: newTitle.trim(),
        difficulty: newDifficulty,
        status: 'completed',
        skill: null,
        questId: null,
        dueDate: '',
      }]);
      setNewTitle('');
      setNewDifficulty(DIFFICULTY_LEVELS.EASY);
      setShowAddForm(false);
    } catch (err) {
      console.error('Error creating and completing mission:', err);
    } finally {
      setAddingMission(false);
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

        {loading ? (
          <p className="review-step-loading">Loading missions...</p>
        ) : filteredMissions.length === 0 && !showAddForm ? (
          <p className="review-step-empty">
            {missions.length === 0
              ? 'Looks like everything\'s been logged — nice work.'
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

        {showAddForm ? (
          <div className="review-add-mission-form">
            <input
              className="review-add-mission-input"
              type="text"
              placeholder="What did you do?"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddMission()}
              autoFocus
            />
            <div className="review-add-mission-difficulty">
              {Object.values(DIFFICULTY_LEVELS).map(d => (
                <button
                  key={d}
                  className={`review-difficulty-btn ${newDifficulty === d ? 'review-difficulty-btn--active' : ''}`}
                  onClick={() => setNewDifficulty(d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
            <div className="review-add-mission-actions">
              <button
                className="story-action-btn story-action-btn--save"
                onClick={handleAddMission}
                disabled={!newTitle.trim() || addingMission}
              >
                {addingMission ? 'Logging...' : 'Log it'}
              </button>
              <button
                className="story-action-btn story-action-btn--cancel"
                onClick={() => { setShowAddForm(false); setNewTitle(''); }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="review-add-mission-link"
            onClick={() => setShowAddForm(true)}
          >
            + Log a mission not in the system
          </button>
        )}
      </div>

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
