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
  getQuest,
  completeQuest,
  reopenQuest,
  restoreQuest
} from '../../services/questService';
import { useMissions } from '../../contexts/MissionsContext';
import { getNextMission } from '../../types/Quests';
import { uncompleteMission } from '../../services/missionService';
import { useMissionCompletion } from '../../contexts/MissionCompletionContext';
import ErrorMessage from '../../components/ui/ErrorMessage';
import LoadingTransition from '../../components/ui/LoadingTransition';
import QuestBankPageSkeleton from './QuestBankPageSkeleton';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
import { useAndroidBackButton } from '../../hooks/useAndroidBackButton';
import './QuestBankPage.css';

const QuestBank = () => {
  const { currentUser } = useAuth();
  const { completeMission: completeMissionOptimistic } = useMissionCompletion();
  const navigate = useNavigate();
  
  const {
    missions,
    isInitialLoading: missionsCacheLoading,
    refresh: refreshMissionsCache,
  } = useMissions();
  const [quests, setQuests] = useState([]);
  // Quests that transitioned to COMPLETED during this page session — kept
  // around so the user sees the completion land (with XP badge, struck-through
  // title) rather than the quest silently disappearing from the active list.
  // Cleared on filter change and on explicit reload, mirroring MissionBank's
  // recentlyCompletedMissions pattern.
  const [recentlyCompletedQuests, setRecentlyCompletedQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [missionsError, setMissionsError] = useState(null);
  const [actionError, setActionError] = useState(null);
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
      setLoading(false);
    }
  };

  // Missions now come from the shared MissionsContext cache. This wrapper
  // exists for legacy call sites; it just kicks the cache refresh.
  const loadMissions = async () => {
    setMissionsError(null);
    try {
      await refreshMissionsCache();
    } catch (err) {
      console.error('Error loading missions:', err);
      setMissionsError("Your missions didn't load. Quest progress may be off.");
    }
  };

  const handleHomeButtonClick = () => {
    navigate('/home');
  };
  useAndroidBackButton(handleHomeButtonClick);

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
  const handleApplyFilters = (newFilters) => {
    // Clear recently-completed-in-this-session when filters change — fresh
    // filter context, fresh slate.
    setRecentlyCompletedQuests([]);
    setFilters(newFilters);
  };

  const handleRestoreQuest = async (questId) => {
    setActionError(null);
    try {
      await restoreQuest(currentUser.uid, questId);
      setQuests(prev => prev.filter(q => q.id !== questId));
    } catch (err) {
      console.error('Error restoring quest:', err);
      setActionError("That quest didn't restore. Try again.");
    }
  };

  // Look up the questId of a mission from local state — used to detect when
  // a mission toggle causes its parent quest to transition states.
  const getQuestIdForMission = (missionId) => {
    const m = missions.find(x => x.id === missionId);
    return m?.questId ?? null;
  };

  // Quest-state reconciliation after a mission toggle: if the toggle pushed
  // the parent quest across the auto-complete / auto-reopen boundary, mirror
  // that into recentlyCompletedQuests so the user sees the transition land
  // (or reopens cleanly).
  const reconcileQuestStateAfterToggle = async (missionId) => {
    const questId = getQuestIdForMission(missionId);
    if (!questId) return;
    try {
      const updatedQuest = await getQuest(currentUser.uid, questId);
      if (updatedQuest.status === 'completed') {
        setRecentlyCompletedQuests(prev =>
          prev.find(q => q.id === updatedQuest.id)
            ? prev.map(q => q.id === updatedQuest.id ? updatedQuest : q)
            : [updatedQuest, ...prev]
        );
      } else {
        setRecentlyCompletedQuests(prev => prev.filter(q => q.id !== updatedQuest.id));
      }
    } catch (err) {
      console.error('Error checking quest state after mission toggle:', err);
    }
  };

  const handleMissionToggleComplete = async (missionId, isCurrentlyCompleted, xpReward) => {
    if (isCurrentlyCompleted) {
      try {
        await uncompleteMission(currentUser.uid, missionId);
        await reconcileQuestStateAfterToggle(missionId);
        await loadQuests();
        await loadMissions();
      } catch (err) {
        console.error('Error uncompleting mission:', err);
      }
      return;
    }

    const mission = missions.find((m) => m.id === missionId);
    // MissionCompletionContext mutates the shared cache directly. The quest
    // list still needs to reconcile (auto-complete / auto-reopen) so we
    // keep onResolved.
    completeMissionOptimistic(missionId, mission, {
      onResolved: async () => {
        await reconcileQuestStateAfterToggle(missionId);
        await loadQuests();
      },
    });
  };

  const handleQuestToggleComplete = async (questId, isCurrentlyCompleted) => {
    setActionError(null);
    try {
      if (isCurrentlyCompleted) {
        await reopenQuest(currentUser.uid, questId);
        setRecentlyCompletedQuests(prev => prev.filter(q => q.id !== questId));
      } else {
        const completed = await completeQuest(currentUser.uid, questId);
        setRecentlyCompletedQuests(prev =>
          prev.find(q => q.id === completed.id)
            ? prev.map(q => q.id === completed.id ? completed : q)
            : [completed, ...prev]
        );
      }
      await loadQuests();
      await loadMissions();
    } catch (err) {
      console.error('Error toggling quest completion:', err);
      setActionError(
        isCurrentlyCompleted
          ? "That quest didn't reopen. Try again."
          : "That quest didn't complete. Try again."
      );
    }
  };


  // Merge the active fetch with this session's just-completed quests.
  // Hide archive view from the merge — recently-completed quests don't make
  // sense in the archive context. Also dedupe in case loadQuests already
  // surfaced a quest the session list also tracks (e.g. when includeCompleted
  // is on).
  const mergedQuests = filters.showArchive
    ? quests
    : (() => {
        const seen = new Set(quests.map(q => q.id));
        const extras = recentlyCompletedQuests.filter(q => !seen.has(q.id));
        return [...quests, ...extras];
      })();

  const displayedQuests = mergedQuests.filter((q) => {
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
    <LoadingTransition loading={loading || missionsCacheLoading} skeleton={<QuestBankPageSkeleton />}>
    <div className="quest-bank-page">
      {loadError && (
        <ErrorMessage
          message={loadError}
          onRetry={() => { setLoadError(null); setReloadTrigger(t => t + 1); }}
        />
      )}

      {missionsError && !loadError && (
        <ErrorMessage
          message={missionsError}
          onRetry={loadMissions}
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

      {actionError && <ErrorMessage message={actionError} />}

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
                onToggleComplete={filters.showArchive ? undefined : handleQuestToggleComplete}
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
    </LoadingTransition>
  );
};

export default QuestBank;