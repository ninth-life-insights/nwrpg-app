// src/pages/QuestBankPage.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import QuestCard from '../components/quests/QuestCard';
import CreateQuestModal from '../components/quests/CreateQuestModal';
import {
  getActiveQuests,
  getCompletedQuests,
  getArchivedQuests,
  restoreQuest
} from '../services/questService';
import { getAllMissions } from '../services/missionService';
import { getNextMission } from '../types/Quests';
import { completeMissionWithRecurrence } from '../services/missionService';
import ErrorMessage from '../components/ui/ErrorMessage';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../utils/fetchWithTimeout';
import './QuestBankPage.css';

const QuestBank = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [quests, setQuests] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [showAddQuest, setShowAddQuest] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadQuests();
      loadMissions();
    }
  }, [currentUser, includeCompleted, includeArchived, reloadTrigger]);

  const loadQuests = async () => {
    if (isDefinitelyOffline()) {
      setLoadError("Your quests didn't load. Check your connection and try again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setIsLoadingSlow(false);
    const slowTimer = setTimeout(() => setIsLoadingSlow(true), 3000);
    try {
      let questData = [];
      if (includeArchived) {
        questData = await withTimeout(getArchivedQuests(currentUser.uid));
      } else if (includeCompleted) {
        const [active, completed] = await withTimeout(
          Promise.all([
            getActiveQuests(currentUser.uid),
            getCompletedQuests(currentUser.uid)
          ])
        );
        questData = [...active, ...completed];
      } else {
        questData = await withTimeout(getActiveQuests(currentUser.uid));
      }
      setQuests(questData);
    } catch (err) {
      console.error('Error loading quests:', err);
      setLoadError(getLoadErrorMessage(err, 'quests'));
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setIsLoadingSlow(false);
    }
  };

  const loadMissions = async () => {
    try {
      const missionData = await getAllMissions(currentUser.uid);
      setMissions(missionData);
    } catch (err) {
      console.error('Error loading missions:', err);
    }
  };

  const handleHomeButtonClick = () => {
    navigate('/home');
  };

  const handleShowAddQuest = () => {
    setShowAddQuest(true);
  };

  const handleCloseAddQuest = () => {
    setShowAddQuest(false);
  };

  const handleQuestCreated = async (newQuest) => {
    // Reload quests to show the new one
    await loadQuests();
  };

  const handleToggleCompleted = () => {
    setIncludeCompleted(!includeCompleted);
    if (!includeCompleted) setIncludeArchived(false);
  };

  const handleToggleArchived = () => {
    setIncludeArchived(!includeArchived);
    if (!includeArchived) setIncludeCompleted(false);
  };

  const handleRestoreQuest = async (questId) => {
    try {
      await restoreQuest(currentUser.uid, questId);
      setQuests(prev => prev.filter(q => q.id !== questId));
    } catch (err) {
      console.error('Error restoring quest:', err);
    }
  };

  const handleMissionToggleComplete = async (missionId, isCurrentlyCompleted, xpReward) => {
    try {
      if (isCurrentlyCompleted) {
        // Handle uncompletion
        // TODO: Import and use uncompleteMission
      } else {
        await completeMissionWithRecurrence(currentUser.uid, missionId);
      }
      
      // Reload quests and missions to update progress
      await loadQuests();
      await loadMissions();
    } catch (err) {
      console.error('Error toggling mission completion:', err);
    }
  };

  const handleMissionViewDetails = (mission) => {
    // TODO: Open mission detail modal
    console.log('View mission details:', mission);
  };

  if (loading) {
    return (
      <div className="quest-bank-page">
        <div className="loading-state">
          Loading quests...
          {isLoadingSlow && <p className="loading-slow-hint">Still searching the realm...</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="quest-bank-page">
      {loadError && (
        <ErrorMessage
          message={loadError}
          onRetry={() => { setLoadError(null); setReloadTrigger(t => t + 1); }}
        />
      )}

      {/* Page Header */}
      <div className="quest-bank-header">
        <div className="top-header">
          <button className="home-button" onClick={handleHomeButtonClick} aria-label="Back to home">
            <span className="material-icons">arrow_back</span>
          </button>
          <h1>Quest Bank</h1>
        </div>
        
        <div className="header-actions">
          {/* Toggle Archive Filter */}
          <button
            onClick={handleToggleArchived}
            className={`filter-btn-header ${includeArchived ? 'active' : ''}`}
            title={includeArchived ? "Hide Archive" : "View Archive"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="21 8 21 21 3 21 3 8"></polyline>
              <rect x="1" y="3" width="22" height="5"></rect>
              <line x1="10" y1="12" x2="14" y2="12"></line>
            </svg>
          </button>

          {/* Toggle Completed Filter */}
          {!includeArchived && (
            <button
              onClick={handleToggleCompleted}
              className="filter-btn-header"
              title={includeCompleted ? "Hide Completed" : "Show Completed"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"></polygon>
              </svg>
            </button>
          )}

          {/* Add Quest Button */}
          {!includeArchived && (
            <button
              onClick={handleShowAddQuest}
              className="add-quest-btn"
            >
              + Add Quest
            </button>
          )}
        </div>
      </div>

      {/* Quest List */}
      <div className="quest-list">
        {quests.length === 0 ? (
          <div className="empty-state">
            <p>
              {includeArchived
                ? 'No archived quests.'
                : 'No active quests. Create your first quest to get started!'}
            </p>
          </div>
        ) : (
          quests.map(quest => {
            const nextMission = getNextMission(quest, missions);

            return (
              <QuestCard
                key={quest.id}
                quest={quest}
                nextMission={nextMission}
                onMissionToggleComplete={handleMissionToggleComplete}
                onMissionViewDetails={handleMissionViewDetails}
                onRestore={includeArchived ? handleRestoreQuest : undefined}
              />
            );
          })
        )}
      </div>

      {/* Quest Creation Modal */}
      <CreateQuestModal
        isOpen={showAddQuest}
        onClose={handleCloseAddQuest}
        onQuestCreated={handleQuestCreated}
      />
    </div>
  );
};

export default QuestBank;