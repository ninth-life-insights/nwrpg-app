// src/pages/EditDailyMissionsPage.js - UPDATED FOR SIMPLIFIED SYSTEM
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Component imports
import AddMissionCard from '../../components/missions/AddMissionCard';
import MissionCardFull from '../../components/missions/MissionCardFull';
import MissionList from '../../components/missions/MissionList';
import MissionFilterModal from '../../components/missions/sub-components/MissionFilterModal';
import Badge from '../../components/ui/Badge';
import DatePickerPill from '../../components/ui/DatePickerPill';

// Service imports - UPDATED for simplified system
import {
  createMission,
  completeMissionWithRecurrence,
  uncompleteMission,
} from '../../services/missionService';
import { useMissions } from '../../contexts/MissionsContext';
import { getRooms } from '../../services/roomService';
import { getAllQuests } from '../../services/questService';

// UPDATED: Import from separate daily mission service
import {
  getDailyMissionsConfig,
  updateDailyMissionsConfig,
  saveDailyMissionSelection,
  getDailyMissionsForDate,
  planDailyMissionsForDate,
  syncScheduledDatesOnMissions,
} from '../../services/dailyMissionService';

import { useQuests } from '../../contexts/QuestsContext';
import { useDailyMissions } from '../../contexts/DailyMissionsContext';

// Date helpers
import {
  isMissionDueToday,
  isMissionDueTomorrow,
  isMissionOverdue,
  toDateString,
  formatForUser,
  fromDateString,
} from '../../utils/dateHelpers';

import { isRecurringMission,
  getRecurrenceDisplayText
} from '../../utils/recurrenceHelpers';

import { hasSkill } from '../../types/Mission';

// Mission helpers
import {
  isMissionCompleted
} from '../../utils/missionHelpers';

import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import { useAndroidBackButton } from '../../hooks/useAndroidBackButton';
import { useDelayedLoadingState } from '../../hooks/useDelayedLoadingState';
import EditDailyMissionsPageSkeleton from './EditDailyMissionsPageSkeleton';
import './EditDailyMissionsPage.css';

const EditDailyMissionsPage = ({
  isModal = false,
  onComplete = null,
  showNavigation = true,
  initialTargetDate = null,  // pre-set the date (YYYY-MM-DD); defaults to today when null
}) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const today = toDateString(new Date());
  const tomorrow = toDateString(new Date(Date.now() + 86400000));

  const { questsMap } = useQuests();
  const { refreshDailyMissions } = useDailyMissions();
  const [targetDate, setTargetDate] = useState(initialTargetDate || today);
  const [dailyMissions, setDailyMissions] = useState([null, null, null]);
  const [showAddMission, setShowAddMission] = useState(false);
  const [showMissionBank, setShowMissionBank] = useState(false);
  const closeMissionBank = useCallback(() => {
    setShowMissionBank(false);
  }, []);
  useModalBackButton(showMissionBank, closeMissionBank);
  // When rendered as a page (not a modal), route the OS back to the page's
  // explicit "up" destination instead of last-URL.
  const handleBack = () => navigate('/home');
  useAndroidBackButton(isModal ? null : handleBack);

  const {
    missions: cachedMissions,
    isInitialLoading: missionsCacheLoading,
    refresh: refreshMissionsCache,
  } = useMissions();
  // Active mission list for the bank picker. Derived synchronously from the
  // shared cache so it stays in sync with completions / edits elsewhere.
  const allActiveMissions = useMemo(() => {
    if (cachedMissions == null) return [];
    return cachedMissions.filter(m => m.status === 'active');
  }, [cachedMissions]);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [bankFilters, setBankFilters] = useState({
    sortBy: 'dueDate', sortOrder: 'asc', skillFilter: '',
    includeCompleted: false, showArchive: false, completedDateRange: 'last7days',
    roomFilter: '', taskTypeFilter: '', questFilter: ''
  });
  const [showBankFilters, setShowBankFilters] = useState(false);
  const closeBankFilters = useCallback(() => setShowBankFilters(false), []);
  const applyBankFilters = useCallback((f) => setBankFilters(f), []);
  const [bankRooms, setBankRooms] = useState([]);
  const [bankQuests, setBankQuests] = useState([]);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [currentConfig, setCurrentConfig] = useState(null);
  // True only when a previously-saved plan was found for targetDate on load
  const [hasSavedPlan, setHasSavedPlan] = useState(false);
  const [selectedMission, setSelectedMission] = useState(null);

  // Reload whenever the target date or the shared cache changes. Including
  // cachedMissions ensures the slot fill runs once the cache becomes available.
  useEffect(() => {
    loadExistingDailyMissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, targetDate, cachedMissions]);

  // Load filter data for the mission bank modal on mount
  useEffect(() => {
    if (!currentUser) return;
    Promise.all([
      getRooms(currentUser.uid),
      getAllQuests(currentUser.uid)
    ]).then(([rooms, quests]) => {
      setBankRooms(rooms || []);
      setBankQuests(quests || []);
    }).catch(() => {});
  }, [currentUser]);

  const loadExistingDailyMissions = async () => {
    if (!currentUser) return;
    if (isDefinitelyOffline()) {
      setError("Your daily plan didn't load. Check your connection and try again.");
      setLoading(false);
      return;
    }
    if (cachedMissions == null) return; // wait for the shared cache
    setLoading(true);
    setError('');
    setDailyMissions([null, null, null]);
    setHasSavedPlan(false);

    try {
      await withTimeout((async () => {
        // Resolve the saved-plan source for this date. Active/completed
        // missions come from the shared cache — no separate fetch needed.
        let missionIds;
        if (targetDate === today) {
          const config = await getDailyMissionsConfig(currentUser.uid);
          setCurrentConfig(config);
          missionIds = (config && config.setForDate === today && config.missionIds?.length > 0)
            ? config.missionIds : null;
        } else {
          setCurrentConfig(null);
          const history = await getDailyMissionsForDate(currentUser.uid, targetDate);
          missionIds = history?.selectedMissionIds?.length > 0 ? history.selectedMissionIds : null;
        }

        setHasSavedPlan(missionIds != null);

        if (missionIds) {
          const selectedMissions = missionIds
            .map(missionId => {
              const mission = cachedMissions.find(m => m.id === missionId);
              if (!mission) console.warn('Mission not found for ID:', missionId);
              return mission;
            })
            .filter(mission => mission != null);

          const newDailyMissions = [null, null, null];
          selectedMissions.forEach((mission, index) => {
            if (index < 3) newDailyMissions[index] = mission;
          });
          setDailyMissions(newDailyMissions);
        }
      })());
    } catch (err) {
      console.error('Error loading existing daily missions:', err);
      setError(getLoadErrorMessage(err, 'daily plan'));
    } finally {
      setLoading(false);
    }
  };

  // Handle creating new mission
const handleAddNewMission = async (missionData) => {

  try {
    setSaving(true);
    setError('');

    handleMissionSelect(missionData, currentSlotIndex);


  } catch (err) {
    setError('Failed to add mission. Please try again.');
  } finally {
    setSaving(false);
  }
};

  // Handle selecting a mission for a slot
 const handleMissionSelect = (mission, slotIndex = currentSlotIndex) => {
  const newDailyMissions = [...dailyMissions];
  newDailyMissions[slotIndex] = mission;
  setDailyMissions(newDailyMissions);
  setShowAddMission(false);
  setShowMissionBank(false);
};

  // Handle removing a mission from a slot
  const handleRemoveMission = (slotIndex) => {
    const newDailyMissions = [...dailyMissions];
    newDailyMissions[slotIndex] = null;
    setDailyMissions(newDailyMissions);
  };

  const handleMissionCardToggleComplete = async (missionId, isCurrentlyCompleted) => {
    try {
      if (isCurrentlyCompleted) {
        await uncompleteMission(currentUser.uid, missionId);
      } else {
        await completeMissionWithRecurrence(currentUser.uid, missionId);
      }
      // Pull the shared cache so any other surface (and this page's daily
      // slots) sees the new status.
      await refreshMissionsCache();
    } catch (err) {
      console.error('Error toggling mission complete:', err);
    }
  };

  const handleMissionCardChanged = async (missionId, action) => {
    setSelectedMission(null);
    if (action === 'deleted' || action === 'archived') {
      setDailyMissions(prev => prev.map(m => m?.id === missionId ? null : m));
      await refreshMissionsCache();
    } else if (action === 'updated') {
      await refreshMissionsCache();
    }
  };

  // Handle clicking empty slot
  const handleEmptySlotClick = (slotIndex) => {
    setCurrentSlotIndex(slotIndex);
    setShowAddMission(true);
  };

  // Handle add new mission button
  const handleAddNewMissionClick = () => {
    const emptySlotIndex = dailyMissions.findIndex(mission => mission === null);
    if (emptySlotIndex !== -1) {
      setCurrentSlotIndex(emptySlotIndex);
      setShowAddMission(true);
    }
  };

  // Handle choose from bank button
  const handleChooseFromBank = () => {
    const emptySlotIndex = dailyMissions.findIndex(mission => mission === null);
    if (emptySlotIndex !== -1) {
      setCurrentSlotIndex(emptySlotIndex);
      setShowMissionBank(true);
    }
  };

  const handleSetDailyMissions = async () => {

  if (!currentUser) {
    setError('You must be logged in to set daily missions');
    return;
  }

  const validMissions = dailyMissions.filter(mission => mission !== null);

    if (validMissions.length < 1) {
      setError('Add at least one mission to save your plan.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const selectedMissionIds = validMissions.map(mission => mission.id);

      // Get previously planned IDs for this date to compute the diff
      const prevHistory = await getDailyMissionsForDate(currentUser.uid, targetDate);
      const prevMissionIds = prevHistory?.selectedMissionIds ?? [];

      if (targetDate === today) {
        // Today: write to config + history (existing flow)
        await updateDailyMissionsConfig(currentUser.uid, selectedMissionIds);
        await saveDailyMissionSelection(currentUser.uid, selectedMissionIds);

        const updatedConfig = await getDailyMissionsConfig(currentUser.uid);
        setCurrentConfig(updatedConfig);
        // Propagate the new config to every mounted mission card.
        refreshDailyMissions();
      } else {
        // Future date: write only to history, never touch config
        await planDailyMissionsForDate(currentUser.uid, selectedMissionIds, targetDate);
      }

      // Sync scheduledDates on mission documents
      await syncScheduledDatesOnMissions(currentUser.uid, prevMissionIds, selectedMissionIds, targetDate);

      if (isModal && onComplete) {
        onComplete();
      } else {
        navigate('/home');
      }

    } catch (err) {
      console.error('Error setting daily missions:', err);
      setError("Your daily missions weren't saved. Try again.");
    } finally {
      setSaving(false);
    }
  };


  // Check if enough slots are filled to save
  const allSlotsFilled = dailyMissions.every(mission => mission !== null);
  const canSave = dailyMissions.some(mission => mission !== null);

  // Show skeleton state — early-return because the JSX below depends on
  // currentConfig / hasSavedPlan etc. that aren't safe to evaluate while loading.
  // Cache-not-ready counts as still loading so the active-mission bank picker
  // can't flash empty before the cache lands.
  const isInitialLoad = loading || missionsCacheLoading;
  const skeletonVisible = useDelayedLoadingState(isInitialLoad, 250);
  if (isInitialLoad) {
    return skeletonVisible ? <EditDailyMissionsPageSkeleton isModal={isModal} /> : null;
  }

  const isTargetToday = targetDate === today;
  const isActiveForDate = isTargetToday
    ? (currentConfig && currentConfig.setForDate === today && currentConfig.missionIds?.length > 0)
    : hasSavedPlan;

  const selectedIds = new Set(dailyMissions.filter(Boolean).map(m => m.id));
  const unselectedActive = allActiveMissions.filter(m => !selectedIds.has(m.id));
  const overdueCount = isTargetToday ? unselectedActive.filter(isMissionOverdue).length : 0;
  const dueTodayCount = isTargetToday ? unselectedActive.filter(isMissionDueToday).length : 0;
  const dueTomorrowCount = isTargetToday ? unselectedActive.filter(isMissionDueTomorrow).length : 0;

  const bankHint = (() => {
    if (overdueCount > 0 && dueTodayCount > 0)
      return `${overdueCount} overdue · ${dueTodayCount} due today`;
    if (overdueCount > 0)
      return `${overdueCount} overdue`;
    if (dueTodayCount > 0)
      return `${dueTodayCount} due today`;
    if (dueTomorrowCount > 0)
      return `${dueTomorrowCount} due tomorrow`;
    return null;
  })();

  // Confirm button label
  const confirmLabel = (() => {
    if (saving) {
      return isActiveForDate ? 'Updating...' : 'Saving...';
    }
    if (isTargetToday) {
      return isActiveForDate ? 'Update Daily Missions' : 'Set Daily Missions';
    }
    const dayLabel = fromDateString(targetDate).format('ddd, MMM D');
    return isActiveForDate ? `Update Plan for ${dayLabel}` : `Plan for ${dayLabel}`;
  })();

  return (
    <div className={`daily-missions-container ${!isTargetToday ? 'future-date-mode' : ''} ${isModal ? 'modal-mode' : ''}`}>
      {!isModal && (
        <header className="dm-page-header">
          <button className="dm-back-btn" onClick={handleBack} aria-label="Back to home">
            <span className="material-icons">arrow_back</span>
          </button>
          <h1 className="dm-page-title">Daily Missions</h1>
          <div className="dm-header-spacer" />
        </header>
      )}

      <div className="daily-missions-header">
        {!isModal && <p className="page-subtitle">
          What are your three most important priorities for the day?
        </p>}

        {/* Date selector pill — full page only */}
        {!isModal && (
          <DatePickerPill
            value={targetDate}
            onChange={setTargetDate}
            heading="Plan for..."
          />
        )}

        {/* Status */}
        <div className={`current-status ${!isTargetToday ? 'future-status' : ''}`}>
          {isTargetToday ? (
            isActiveForDate ? (
              <p className="status-text">✅ Daily missions are active for today. You can update them below.</p>
            ) : (
              <p className="status-text">No daily missions set for today.</p>
            )
          ) : (
            isActiveForDate ? (
              <p className="status-text">✅ Missions planned for {fromDateString(targetDate).format('ddd, MMM D')}. You can update them below.</p>
            ) : (
              <p className="status-text">No missions planned for {fromDateString(targetDate).format('ddd, MMM D')} yet.</p>
            )
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Mission Slots */}
      <div className="mission-slots">
        {dailyMissions.map((mission, index) => (
          <div key={index} className="mission-slot">
            {mission ? (
            (() => {
              // Helper to get due date info
              const getDueDateInfo = () => {
                  if (!mission.dueDate) return null;

                  // Remove "due-" prefix from status since we add it in the Badge variant
                  if (isMissionOverdue(mission)) return { status: 'overdue', display: 'Overdue' };
                  if (isMissionDueToday(mission)) return { status: 'today', display: 'Today' };
                  if (isMissionDueTomorrow(mission)) return { status: 'tomorrow', display: 'Tomorrow' };

                  return {
                    status: 'upcoming',
                    display: formatForUser(mission.dueDate)
                  };
                };
              // Calculate these once per mission
              const isRecurring = isRecurringMission(mission);
              const recurrenceText = getRecurrenceDisplayText(mission);
              const dueDateInfo = getDueDateInfo(mission);
              const missionHasSkill = hasSkill(mission);
              const quest = mission.questId ? questsMap[mission.questId] ?? null : null;

            return (
              <div
                className={`mission-slot-filled ${isMissionCompleted(mission) ? 'completed' : ''}`}
                onClick={() => setSelectedMission(mission)}
                style={{ cursor: 'pointer' }}
              >
                <div className="mission-info">
                  <h3 className={`mission-title ${isMissionCompleted(mission) ? 'completed' : ''}`}>{mission.title}</h3>
                  <p className={`mission-description ${isMissionCompleted(mission) ? 'completed' : ''}`}>{mission.description}</p>
                  <div className="mission-badges">
                    {/* Recurrence badge */}
                    {isRecurring && (
                      <Badge variant="recurrence">
                        {recurrenceText}
                      </Badge>
                    )}

                    {/* quest badge */}
                    {quest && (
                      <Badge variant="quest">
                        {quest.title}
                      </Badge>
                    )}

                    {/* Due date badge */}
                    {dueDateInfo && (
                      <Badge variant={`due-${dueDateInfo.status}`}>
                        {dueDateInfo.display}
                      </Badge>
                    )}

                    {/* Difficulty badge */}
                    <Badge variant="difficulty" difficulty={mission.difficulty}>
                      {mission.difficulty.charAt(0).toUpperCase() + mission.difficulty.slice(1)}
                    </Badge>

                    {/* skill badge */}
                    {missionHasSkill && (
                      <Badge variant="skill">
                        {mission.skill}
                      </Badge>
                    )}

                  </div>
                </div>
                <button
                  className="remove-mission-btn"
                  onClick={(e) => { e.stopPropagation(); handleRemoveMission(index); }}
                  title="Remove mission"
                  disabled={saving}
                >
                  −
                </button>
              </div>
            );
          })()
        ) : (
              // Empty slot
              <div
                className="mission-slot-empty clickable"
                onClick={() => handleEmptySlotClick(index)}
                role="button"
                tabIndex="0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleEmptySlotClick(index);
                  }
                }}
              >
                <div className="slot-placeholder">
                  <div className="slot-number">{index + 1}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button
          className="action-btn secondary"
          onClick={handleAddNewMissionClick}
          disabled={allSlotsFilled || saving}
        >
          + Add New Mission
        </button>

        <button
          className={`action-btn secondary${bankHint ? ' action-btn--with-hint' : ''}`}
          onClick={handleChooseFromBank}
          disabled={allSlotsFilled || saving}
        >
          📋 Choose from Mission Bank
          {bankHint && (
            <span className="bank-btn-due-soon-hint">{bankHint}</span>
          )}
        </button>
      </div>

      {/* Set Daily Missions Button */}
      {isModal ? (
        <div className="set-missions-footer set-missions-footer--modal">
          <button
            className={`set-missions-btn ${canSave ? 'enabled' : 'disabled'}`}
            onClick={handleSetDailyMissions}
            disabled={!canSave || saving}
          >
            {confirmLabel}
          </button>

          {!canSave && (
            <p className="requirements-text">Add at least one mission to save.</p>
          )}
        </div>
      ) : (
        <div className="set-missions-footer set-missions-footer--page">
          <button
            className={`set-missions-btn ${canSave ? 'enabled' : 'disabled'}`}
            onClick={handleSetDailyMissions}
            disabled={!canSave || saving}
          >
            {confirmLabel}
          </button>

          {!canSave && (
            <p className="requirements-text">Add at least one mission to save.</p>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddMission && (
        <AddMissionCard
          onAddMission={handleAddNewMission}
          onCancel={() => setShowAddMission(false)}
        />
      )}

      {showMissionBank && (
        <div className="mission-bank-overlay">
          <div className="mission-bank-modal">
            <div className="modal-header">
              <h2>Choose from Mission Bank</h2>
              <button
                className="close-btn"
                onClick={() => setShowMissionBank(false)}
              >
                ×
              </button>
            </div>

            <div className="bank-search-bar">
              <button
                className={`bank-filter-btn${(bankFilters.skillFilter || bankFilters.roomFilter || bankFilters.taskTypeFilter || bankFilters.questFilter) ? ' bank-filter-btn--active' : ''}`}
                onClick={() => setShowBankFilters(true)}
                aria-label="Filter missions"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"></polygon>
                </svg>
                {(bankFilters.skillFilter || bankFilters.roomFilter || bankFilters.taskTypeFilter || bankFilters.questFilter) && (
                  <span className="bank-filter-dot" />
                )}
              </button>
              <span className="material-icons bank-search-icon">search</span>
              <input
                type="text"
                className="bank-search-input"
                placeholder="Search missions..."
                value={bankSearchQuery}
                onChange={(e) => setBankSearchQuery(e.target.value)}
              />
              {bankSearchQuery && (
                <button
                  className="bank-search-clear"
                  onClick={() => setBankSearchQuery('')}
                  aria-label="Clear search"
                >
                  <span className="material-icons">close</span>
                </button>
              )}
            </div>

            <div className="bank-mission-scroll">
              <MissionList
                selectionMode={true}
                onMissionSelect={(mission) => handleMissionSelect(mission)}
                selectedMissions={dailyMissions.filter(m => m !== null)}
                maxSelections={3}
                filters={bankFilters}
                searchQuery={bankSearchQuery}
              />
            </div>
          </div>
        </div>
      )}

      <MissionFilterModal
        isOpen={showBankFilters}
        onClose={closeBankFilters}
        currentFilters={bankFilters}
        onApplyFilters={applyBankFilters}
        rooms={bankRooms}
        quests={bankQuests}
        showArchiveToggle={false}
      />

      {/* Mission detail view */}
      {selectedMission && (
        <MissionCardFull
          mission={selectedMission}
          onClose={() => setSelectedMission(null)}
          onToggleComplete={handleMissionCardToggleComplete}
          onMissionChanged={handleMissionCardChanged}
        />
      )}

    </div>
  );
};

export default EditDailyMissionsPage;
