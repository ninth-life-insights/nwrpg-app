// src/components/review/QuestProgressStep.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  getActiveQuests,
  getPlanningQuests,
  activateQuest,
  archiveQuest,
  reorderQuestMissions,
} from '../../services/questService';
import {
  getAllMissions,
  completeMissionWithRecurrence,
  uncompleteMission,
} from '../../services/missionService';
import { getQuestActivityForWeek } from '../../services/weeklyReviewService';
import { QUEST_STATUS, calculateQuestProgress } from '../../types/Quests';
import { MISSION_STATUS } from '../../types/Mission';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import { withTimeout, isDefinitelyOffline } from '../../utils/fetchWithTimeout';
import ErrorMessage from '../ui/ErrorMessage';
import StickyFooter from '../ui/StickyFooter';
import './QuestProgressStep.css';

const QuestProgressStep = ({ weekStartDate, weekEndDate, onNext, onBack }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [quests, setQuests] = useState([]);
  const [weekActivity, setWeekActivity] = useState({}); // { [questId]: { missionsCompleted } }
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Modal state
  const [selectedQuest, setSelectedQuest] = useState(null); // quest object
  const [questMissions, setQuestMissions] = useState([]);
  const [missionOrder, setMissionOrder] = useState([]); // IDs in order
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    if (isDefinitelyOffline()) {
      setLoadError("Your quests didn't load. Check your connection and try again.");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [active, planning, activity] = await withTimeout(
        Promise.all([
          getActiveQuests(currentUser.uid),
          getPlanningQuests(currentUser.uid),
          getQuestActivityForWeek(currentUser.uid, weekStartDate, weekEndDate),
        ])
      );
      // Active quests first, then planning
      setQuests([...active, ...planning]);
      setWeekActivity(activity);
    } catch (err) {
      console.error('Error loading quest data:', err);
      setLoadError("Your quests didn't load.");
    } finally {
      setLoading(false);
    }
  }, [currentUser, weekStartDate, weekEndDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleActivate = async (quest) => {
    setActionError(null);
    try {
      await activateQuest(currentUser.uid, quest.id);
      await loadData();
    } catch (err) {
      setActionError(`That quest didn't activate. ${err.message?.includes('no missions') ? 'Add missions to it first.' : 'Try again.'}`);
    }
  };

  const handleArchive = async (quest) => {
    setActionError(null);
    try {
      await archiveQuest(currentUser.uid, quest.id);
      await loadData();
    } catch {
      setActionError("That quest didn't archive. Try again.");
    }
  };

  // ─── Quest detail modal ───────────────────────────────────────────────────

  const openQuestModal = async (quest) => {
    setSelectedQuest(quest);
    setModalError(null);
    setModalLoading(true);
    try {
      const allMissions = await getAllMissions(currentUser.uid);
      const filtered = allMissions.filter(
        m => m.questId === quest.id && m.status !== MISSION_STATUS.EXPIRED
      );
      // Sort by missionOrder[]
      const order = quest.missionOrder?.length ? quest.missionOrder : filtered.map(m => m.id);
      const sorted = order
        .map(id => filtered.find(m => m.id === id))
        .filter(Boolean);
      // Append any missions not in missionOrder (shouldn't happen but defensive)
      filtered.forEach(m => { if (!sorted.find(s => s.id === m.id)) sorted.push(m); });
      setQuestMissions(sorted);
      setMissionOrder(sorted.map(m => m.id));
    } catch (err) {
      setModalError("That quest's missions didn't load. Try again.");
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedQuest(null);
    setQuestMissions([]);
    setMissionOrder([]);
    setModalError(null);
  };

  // Matches MissionCardCondensed's onToggleComplete(missionId, isCompleted, xpReward, spReward)
  const handleToggleMission = async (missionId, isCompleted) => {
    setModalError(null);
    try {
      if (isCompleted) {
        await uncompleteMission(currentUser.uid, missionId);
      } else {
        await completeMissionWithRecurrence(currentUser.uid, missionId);
      }
      // Refresh mission list and quest in modal
      const allMissions = await getAllMissions(currentUser.uid);
      const filtered = allMissions.filter(
        m => m.questId === selectedQuest.id && m.status !== MISSION_STATUS.EXPIRED
      );
      const sorted = missionOrder
        .map(id => filtered.find(m => m.id === id))
        .filter(Boolean);
      filtered.forEach(m => { if (!sorted.find(s => s.id === m.id)) sorted.push(m); });
      setQuestMissions(sorted);
      // Refresh quest list to update progress
      await loadData();
    } catch {
      setModalError(`That mission didn't ${isCompleted ? 'undo' : 'complete'}. Try again.`);
    }
  };

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const newOrder = [...missionOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setMissionOrder(newOrder);
    const newSorted = newOrder.map(id => questMissions.find(m => m.id === id)).filter(Boolean);
    setQuestMissions(newSorted);
    try {
      await reorderQuestMissions(currentUser.uid, selectedQuest.id, newOrder);
    } catch {
      setModalError("That reorder didn't save. Try again.");
    }
  };

  const handleMoveDown = async (index) => {
    if (index === missionOrder.length - 1) return;
    const newOrder = [...missionOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setMissionOrder(newOrder);
    const newSorted = newOrder.map(id => questMissions.find(m => m.id === id)).filter(Boolean);
    setQuestMissions(newSorted);
    try {
      await reorderQuestMissions(currentUser.uid, selectedQuest.id, newOrder);
    } catch {
      setModalError("That reorder didn't save. Try again.");
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const activeQuests = quests.filter(q => q.status === QUEST_STATUS.ACTIVE);
  const planningQuests = quests.filter(q => q.status === QUEST_STATUS.PLANNING);

  const renderQuestRow = (quest) => {
    const progress = calculateQuestProgress(quest);
    const thisWeekCount = weekActivity[quest.id]?.missionsCompleted ?? 0;
    const isPlanning = quest.status === QUEST_STATUS.PLANNING;
    const isActive = quest.status === QUEST_STATUS.ACTIVE;

    return (
      <div key={quest.id} className="quest-progress-row">
        <div className="quest-progress-row-main">
          <div className="quest-progress-row-info">
            <div className="quest-progress-row-title-row">
              <span className="quest-progress-row-title">{quest.title}</span>
              {isPlanning && (
                <span className="quest-progress-planning-badge">planning</span>
              )}
            </div>
            <div className="quest-progress-bar-row">
              <div className="quest-progress-bar-track">
                <div
                  className="quest-progress-bar-fill"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <span className="quest-progress-bar-count">
                {progress.completed}/{progress.total} overall
              </span>
            </div>
            {isActive && (
              <span className="quest-progress-week-activity">
                {thisWeekCount === 0
                  ? 'No missions this week'
                  : `${thisWeekCount} mission${thisWeekCount !== 1 ? 's' : ''} this week`}
              </span>
            )}
          </div>

          <div className="quest-progress-row-actions">
            {isPlanning && (
              <button
                className="quest-progress-action-btn quest-progress-action-btn--activate"
                onClick={() => handleActivate(quest)}
              >
                Activate
              </button>
            )}
            {isActive && (
              <button
                className="quest-progress-action-btn quest-progress-action-btn--archive"
                onClick={() => handleArchive(quest)}
                title="Archive this quest"
              >
                Archive
              </button>
            )}
            <button
              className="quest-progress-action-btn quest-progress-action-btn--open"
              onClick={() => openQuestModal(quest)}
            >
              <span className="material-icons">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="review-step">
        <div className="review-step-body">
          <h2 className="review-step-heading">Quest Progress</h2>
          <p className="review-step-subtext">How are your quests tracking this week?</p>

          {loadError && (
            <ErrorMessage message={loadError} onRetry={loadData} />
          )}
          {actionError && (
            <ErrorMessage message={actionError} />
          )}

          {loading && (
            <p className="review-step-loading">Loading quests…</p>
          )}

          {!loading && !loadError && quests.length === 0 && (
            <div className="quest-progress-empty">
              <p className="review-step-empty">No active quests yet.</p>
              <button
                className="quest-progress-start-btn"
                onClick={() => navigate('/quest-bank')}
              >
                Start a Quest
              </button>
            </div>
          )}

          {!loading && !loadError && activeQuests.length > 0 && (
            <div className="quest-progress-section">
              {activeQuests.map(renderQuestRow)}
            </div>
          )}

          {!loading && !loadError && planningQuests.length > 0 && (
            <div className="quest-progress-section">
              <p className="quest-progress-section-label">In Planning</p>
              {planningQuests.map(renderQuestRow)}
            </div>
          )}
        </div>

        <StickyFooter>
          <button className="review-next-btn" onClick={onNext}>
            Next
          </button>
          <button className="review-skip-link" onClick={onBack}>
            Back
          </button>
        </StickyFooter>
      </div>

      {/* Quest detail modal */}
      {selectedQuest && (
        <div className="quest-modal-overlay" onClick={closeModal}>
          <div
            className="quest-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="quest-modal-header">
              <h3 className="quest-modal-title">{selectedQuest.title}</h3>
              <button className="quest-modal-close" onClick={closeModal}>
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="quest-modal-body">
              {modalError && <ErrorMessage message={modalError} />}

              {modalLoading && (
                <p className="review-step-loading">Loading missions…</p>
              )}

              {!modalLoading && questMissions.length === 0 && (
                <p className="review-step-empty">No missions in this quest yet.</p>
              )}

              {!modalLoading && questMissions.length > 0 && (
                <ul className="quest-modal-mission-list">
                  {questMissions.map((mission, index) => (
                    <li key={mission.id} className="quest-modal-mission-item">
                      <div className="quest-modal-mission-reorder">
                        <button
                          className="quest-modal-reorder-btn"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          aria-label="Move up"
                        >
                          <span className="material-icons">expand_less</span>
                        </button>
                        <button
                          className="quest-modal-reorder-btn"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === questMissions.length - 1}
                          aria-label="Move down"
                        >
                          <span className="material-icons">expand_more</span>
                        </button>
                      </div>
                      <div className="quest-modal-mission-card">
                        <MissionCardCondensed
                          mission={mission}
                          onToggleComplete={handleToggleMission}
                          onViewDetails={() => {}}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QuestProgressStep;
