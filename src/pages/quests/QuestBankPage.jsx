// src/pages/QuestBankPage.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import QuestCard from '../../components/quests/QuestCard';
import CreateQuestModal from '../../components/quests/CreateQuestModal';
import QuestFilterModal, { QUEST_FILTER_DEFAULTS } from '../../components/quests/QuestFilterModal';
import {
  getActiveQuests,
  getCompletedQuests,
  getArchivedQuests,
  restoreQuest
} from '../../services/questService';
import { getAllMissions } from '../../services/missionService';
import { getNextMission } from '../../types/Quests';
import { completeMissionWithRecurrence } from '../../services/missionService';
import ErrorMessage from '../../components/ui/ErrorMessage';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
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
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(QUEST_FILTER_DEFAULTS);

  useEffect(() => {
    if (currentUser) {
      loadQuests();
      loadMissions();
    }
  }, [currentUser, filters.includeCompleted, filters.showArchive, reloadTrigger]);

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
      if (filters.showArchive) {
        questData = await withTimeout(getArchivedQuests(currentUser.uid));
      } else if (filters.includeCompleted) {
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
    await Promise.all([loadQuests(), loadMissions()]);
  };

  const handleShowFilters = () => setShowFilterModal(true);
  const handleHideFilters = () => setShowFilterModal(false);
  const handleApplyFilters = (newFilters) => setFilters(newFilters);

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

  const displayedQuests = quests.filter((q) => {
    if (filters.difficulty && q.difficulty !== filters.difficulty) return false;
    if (searchQuery && !q.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const hasActiveFilters =
    filters.difficulty !== '' ||
    filters.includeCompleted ||
    filters.showArchive ||
    searchQuery !== '';

  const emptyStateMessage = (() => {
    if (searchQuery) return 'No quests match your search.';
    if (filters.difficulty) return 'No quests match your current filters.';
    if (filters.showArchive) return 'No archived quests.';
    return 'No active quests. Create your first quest to get started!';
  })();

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
      </div>

      {/* Search + filter row */}
      <div className="quest-bank-search-row">
        <div className="quest-bank-search">
          <span className="material-icons search-icon">search</span>
          <input
            type="text"
            className="quest-bank-search-input"
            placeholder="Search quests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <span className="material-icons">close</span>
            </button>
          )}
        </div>

        <button
          onClick={handleShowFilters}
          className={`filter-btn-header${hasActiveFilters ? ' filter-btn-active' : ''}`}
          title="Filter Quests"
          aria-label="Filter Quests"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"></polygon>
          </svg>
          {hasActiveFilters && <span className="filter-active-dot" />}
        </button>
      </div>

      {/* Quest List */}
      <div className="quest-list">
        {displayedQuests.length === 0 ? (
          <div className="empty-state">
            <p>{emptyStateMessage}</p>
            {filters.showArchive && (
              <button
                type="button"
                className="empty-state-link"
                onClick={() => setFilters({ ...filters, showArchive: false })}
              >
                Back to quests →
              </button>
            )}
          </div>
        ) : (
          displayedQuests.map(quest => {
            const nextMission = getNextMission(quest, missions);
            const activeMissionCount = missions.filter(
              m => m.questId === quest.id && m.status !== 'expired' && m.status !== 'deleted'
            ).length;

            return (
              <QuestCard
                key={quest.id}
                quest={quest}
                nextMission={nextMission}
                activeMissionCount={activeMissionCount}
                onMissionToggleComplete={handleMissionToggleComplete}
                onRestore={filters.showArchive ? handleRestoreQuest : undefined}
              />
            );
          })
        )}
      </div>

      {!filters.showArchive && (
        <button
          className="add-quest-fab"
          onClick={handleShowAddQuest}
          aria-label="Add Quest"
        >
          <span className="material-icons">add</span>
          Add Quest
        </button>
      )}

      {/* Quest Creation Modal */}
      <CreateQuestModal
        isOpen={showAddQuest}
        onClose={handleCloseAddQuest}
        onQuestCreated={handleQuestCreated}
      />

      {/* Filter Modal */}
      <QuestFilterModal
        isOpen={showFilterModal}
        onClose={handleHideFilters}
        currentFilters={filters}
        onApplyFilters={handleApplyFilters}
      />
    </div>
  );
};

export default QuestBank;