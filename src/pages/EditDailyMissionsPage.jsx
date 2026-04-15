// src/pages/EditDailyMissionsPage.js - UPDATED FOR SIMPLIFIED SYSTEM
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Component imports
import AddMissionCard from '../components/missions/AddMissionCard';
import MissionList from '../components/missions/MissionList';
import Badge from '../components/ui/Badge';

// Service imports - UPDATED for simplified system
import {
  getActiveMissions,
  getCompletedMissions,
  createMission
} from '../services/missionService';

// UPDATED: Import from separate daily mission service
import {
  getDailyMissionsConfig,
  updateDailyMissionsConfig,
  saveDailyMissionSelection,
  getDailyMissionsForDate,
  planDailyMissionsForDate,
} from '../services/dailyMissionService';

import { getAllQuests } from '../services/questService';

// Date helpers
import {
  isMissionDueToday,
  isMissionDueTomorrow,
  isMissionOverdue,
  toDateString,
  formatForUser,
  fromDateString,
} from '../utils/dateHelpers';

import { isRecurringMission,
  getRecurrenceDisplayText
} from '../utils/recurrenceHelpers';

import { hasSkill } from '../types/Mission';

// Mission helpers
import {
  isMissionCompleted
} from '../utils/missionHelpers';

import './EditDailyMissionsPage.css';

const EditDailyMissionsPage = ({
  isModal = false,
  onComplete = null,
  showNavigation = true
}) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const today = toDateString(new Date());
  const tomorrow = toDateString(new Date(Date.now() + 86400000));

  const [targetDate, setTargetDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dailyMissions, setDailyMissions] = useState([null, null, null]);
  const [quests, setQuests] = useState([]);
  const [showAddMission, setShowAddMission] = useState(false);
  const [showMissionBank, setShowMissionBank] = useState(false);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [currentConfig, setCurrentConfig] = useState(null);

  // Reload whenever the target date changes
  useEffect(() => {
    loadExistingDailyMissions();
    loadQuests();
  }, [currentUser, targetDate]);

  const loadExistingDailyMissions = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError('');
      setDailyMissions([null, null, null]);

      let missionIds = null;

      if (targetDate === today) {
        // Today: use config as the source of truth (existing logic)
        const config = await getDailyMissionsConfig(currentUser.uid);
        setCurrentConfig(config);

        if (config && config.setForDate === today && config.missionIds?.length > 0) {
          missionIds = config.missionIds;
        }
      } else {
        // Future date: load from dailyHistory
        setCurrentConfig(null);
        const history = await getDailyMissionsForDate(currentUser.uid, targetDate);
        if (history?.selectedMissionIds?.length > 0) {
          missionIds = history.selectedMissionIds;
        }
      }

      if (missionIds) {
        const [activeMissions, completedMissions] = await Promise.all([
          getActiveMissions(currentUser.uid),
          getCompletedMissions ? getCompletedMissions(currentUser.uid) : Promise.resolve([])
        ]);

        const allMissions = [...activeMissions, ...completedMissions];

        const selectedMissions = missionIds
          .map(missionId => {
            const mission = allMissions.find(m => m.id === missionId);
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

    } catch (err) {
      console.error('Error loading existing daily missions:', err);
      setError('Failed to load existing daily missions');
    } finally {
      setLoading(false);
    }
  };

  const loadQuests = async () => {
    try {
      const questData = await getAllQuests(currentUser.uid);
      setQuests(questData);
    } catch (err) {
      console.error('Error loading quests:', err);
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

    if (validMissions.length !== 3) {
      setError('Please select exactly 3 missions for your daily missions.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const selectedMissionIds = validMissions.map(mission => mission.id);

      if (targetDate === today) {
        // Today: write to config + history (existing flow)
        await updateDailyMissionsConfig(currentUser.uid, selectedMissionIds);
        await saveDailyMissionSelection(currentUser.uid, selectedMissionIds);

        const updatedConfig = await getDailyMissionsConfig(currentUser.uid);
        setCurrentConfig(updatedConfig);
      } else {
        // Future date: write only to history, never touch config
        await planDailyMissionsForDate(currentUser.uid, selectedMissionIds, targetDate);
      }

      if (isModal && onComplete) {
        onComplete();
      } else {
        navigate('/home');
      }

    } catch (err) {
      console.error('Error setting daily missions:', err);
      setError('Failed to set daily missions. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDateSelect = (date) => {
    setTargetDate(date);
    setShowDatePicker(false);
  };

  // Check if all slots are filled
  const allSlotsFilled = dailyMissions.every(mission => mission !== null);

  // Show loading state
  if (loading) {
    return (
      <div className="daily-missions-container">
        <div className="loading-message">
          Loading daily missions...
        </div>
      </div>
    );
  }

  const isTargetToday = targetDate === today;
  const isActiveForDate = isTargetToday
    ? (currentConfig && currentConfig.setForDate === today && currentConfig.missionIds?.length > 0)
    : dailyMissions.some(m => m !== null);

  // Human-readable date for the header pill
  const targetDateDisplay = isTargetToday
    ? `Today — ${fromDateString(targetDate).format('ddd, MMM D')}`
    : targetDate === tomorrow
      ? `Tomorrow — ${fromDateString(targetDate).format('ddd, MMM D')}`
      : fromDateString(targetDate).format('ddd, MMM D');

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
      <div className="daily-missions-header">
        {!isModal && <h1 className="page-title">Set Daily Missions</h1>}
        {!isModal && <p className="page-subtitle">
          What are your three most important priorities for the day?
        </p>}

        {/* Date selector pill */}
        <button
          className={`date-selector-pill ${!isTargetToday ? 'future' : ''}`}
          onClick={() => setShowDatePicker(true)}
          aria-label="Change planning date"
        >
          <span className="date-selector-icon">📅</span>
          <span className="date-selector-label">{targetDateDisplay}</span>
          <span className="date-selector-caret">▾</span>
        </button>

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
              const quest = mission ? quests.find(q => q.id === mission.questId) : null;

            return (
              <div className={`mission-slot-filled ${isMissionCompleted(mission) ? 'completed' : ''}`}>
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
                  onClick={() => handleRemoveMission(index)}
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
          className="action-btn secondary"
          onClick={handleChooseFromBank}
          disabled={allSlotsFilled || saving}
        >
          📋 Choose from Mission Bank
        </button>
      </div>

      {/* Set Daily Missions Button */}
      <div className="set-missions-section">
        <button
          className={`set-missions-btn ${allSlotsFilled ? 'enabled' : 'disabled'}`}
          onClick={handleSetDailyMissions}
          disabled={!allSlotsFilled || saving}
        >
          {confirmLabel}
        </button>

        {!allSlotsFilled && (
          <p className="requirements-text">
            Fill all 3 slots to set your daily missions
          </p>
        )}
      </div>

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
            <MissionList
              selectionMode={true}
              onMissionSelect={(mission) => handleMissionSelect(mission)}
              selectedMissions={dailyMissions.filter(m => m !== null)}
              maxSelections={3}
            />
          </div>
        </div>
      )}

      {/* Date Picker Sheet */}
      {showDatePicker && (
        <div className="date-picker-overlay" onClick={() => setShowDatePicker(false)}>
          <div className="date-picker-sheet" onClick={e => e.stopPropagation()}>
            <p className="date-picker-heading">Plan for...</p>
            <button
              className={`date-picker-option ${targetDate === today ? 'active' : ''}`}
              onClick={() => handleDateSelect(today)}
            >
              Today — {fromDateString(today).format('ddd, MMM D')}
            </button>
            <button
              className={`date-picker-option ${targetDate === tomorrow ? 'active' : ''}`}
              onClick={() => handleDateSelect(tomorrow)}
            >
              Tomorrow — {fromDateString(tomorrow).format('ddd, MMM D')}
            </button>
            <div className="date-picker-custom">
              <label className="date-picker-custom-label" htmlFor="custom-date-input">Choose a date</label>
              <input
                id="custom-date-input"
                type="date"
                className="date-picker-input"
                min={today}
                defaultValue={targetDate !== today && targetDate !== tomorrow ? targetDate : ''}
                onChange={e => { if (e.target.value) handleDateSelect(e.target.value); }}
              />
            </div>
            <button className="date-picker-cancel" onClick={() => setShowDatePicker(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditDailyMissionsPage;
