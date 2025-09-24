// src/pages/EditDailyMissionsPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

// FIXED: Use refactored components and correct imports
import AddMissionCard from '../components/missions/AddMissionCard';
import MissionList from '../components/missions/MissionList';
import DifficultyBadge from '../components/missions/sub-components/DifficultyBadge';

// FIXED: Use proper service functions
import { 
  getActiveMissions, 
  getDailyMissionsConfig,
  updateDailyMissionsConfig,
  createMission
} from '../services/missionService';

// FIXED: Use standardized date helpers
import {
  formatDueDateForUser,
  getDueDateStatus
} from '../utils/dateHelpers';

// FIXED: Use mission helpers for status and creation
import { 
  isMissionCompleted 
} from '../utils/missionHelpers';

// FIXED: Use type system for mission creation
import {
  createMissionTemplate,
  DIFFICULTY_LEVELS,
  MISSION_STATUS
} from '../types/Mission';

import './EditDailyMissionsPage.css';
import { useNavigate } from 'react-router-dom';

const EditDailyMissionsPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [dailyMissions, setDailyMissions] = useState([null, null, null]);
  const [showAddMission, setShowAddMission] = useState(false);
  const [showMissionBank, setShowMissionBank] = useState(false);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [currentDailyConfig, setCurrentDailyConfig] = useState(null);

  // Load existing daily missions configuration on component mount
  useEffect(() => {
    loadExistingDailyMissions();
  }, [currentUser]);

  const loadExistingDailyMissions = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      
      // Load current daily mission configuration
      const config = await getDailyMissionsConfig(currentUser.uid);
      console.log('Loaded daily config:', config); // DEBUG
      setCurrentDailyConfig(config);
      
      if (config && config.selectedMissionIds && config.isActive) {
        console.log('Config is active with missions:', config.selectedMissionIds); // DEBUG
        // Load the actual mission data for each selected mission
        const allMissions = await getActiveMissions(currentUser.uid);
        console.log('All active missions:', allMissions.length); // DEBUG
        
        // FIXED: Better handling of mission loading with validation
        const selectedMissions = config.selectedMissionIds
          .map(missionId => {
            const mission = allMissions.find(mission => mission.id === missionId);
            if (!mission) {
              console.warn('Mission not found for ID:', missionId); // DEBUG
            }
            return mission;
          })
          .filter(mission => mission != null); // Remove any null/undefined missions
        
        console.log('Found selected missions:', selectedMissions.length); // DEBUG
        
        // Fill the slots with the selected missions
        const newDailyMissions = [null, null, null];
        selectedMissions.forEach((mission, index) => {
          if (index < 3) {
            newDailyMissions[index] = mission;
          }
        });
        setDailyMissions(newDailyMissions);
      } else {
        console.log('Config not active or missing missions:', { 
          hasConfig: !!config, 
          isActive: config?.isActive, 
          hasMissionIds: !!config?.selectedMissionIds?.length 
        }); // DEBUG
        // Reset slots if no active config
        setDailyMissions([null, null, null]);
      }
      
    } catch (err) {
      console.error('Error loading existing daily missions:', err);
      setError('Failed to load existing daily missions');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Handle mission creation using proper types and helpers
  const handleAddNewMission = async (missionData) => {
    try {
      setSaving(true);
      
      // Use createMissionTemplate to ensure proper structure
      const properMissionData = createMissionTemplate({
        ...missionData,
        status: MISSION_STATUS.ACTIVE,
        category: 'daily',
        isDailyMission: false // Will be set when we save daily missions
      });

      // Create the mission using service
      const missionId = await createMission(currentUser.uid, properMissionData);
      
      if (!missionId) {
        throw new Error('Failed to create mission: No ID returned');
      }

      const newMission = {
        ...properMissionData,
        id: missionId,
        createdAt: new Date()
      };

      // Add to current slot
      handleMissionSelect(newMission, currentSlotIndex);
      
    } catch (err) {
      console.error('Error creating new mission:', err);
      setError('Failed to create mission. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle adding a mission to a specific slot
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

  // Handle clicking on an empty slot
  const handleEmptySlotClick = (slotIndex) => {
    setCurrentSlotIndex(slotIndex);
    setShowAddMission(true);
  };

  // Handle adding new mission - finds first empty slot
  const handleAddNewMissionClick = () => {
    const emptySlotIndex = dailyMissions.findIndex(mission => mission === null);
    if (emptySlotIndex !== -1) {
      setCurrentSlotIndex(emptySlotIndex);
      setShowAddMission(true);
    }
  };

  // Handle choosing from mission bank - finds first empty slot
  const handleChooseFromBank = () => {
    const emptySlotIndex = dailyMissions.findIndex(mission => mission === null);
    if (emptySlotIndex !== -1) {
      setCurrentSlotIndex(emptySlotIndex);
      setShowMissionBank(true);
    }
  };

  // FIXED: Use proper service function for updating daily missions
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
      
      console.log('Setting daily missions:', validMissions);
      
      // FIXED: Use the proper service function
      const selectedMissionIds = validMissions.map(mission => mission.id);
      await updateDailyMissionsConfig(currentUser.uid, selectedMissionIds);
      
      // FIXED: Reload the actual config from database instead of assuming
      const updatedConfig = await getDailyMissionsConfig(currentUser.uid);
      console.log('Updated config after save:', updatedConfig); // DEBUG
      setCurrentDailyConfig(updatedConfig);
      
      alert('Daily missions set successfully! Your 3 daily missions are now active.');
      navigate('/home');
      
    } catch (err) {
      console.error('Error setting daily missions:', err);
      setError('Failed to set daily missions. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Check if all slots are filled
  const allSlotsFilled = dailyMissions.every(mission => mission !== null);

  if (loading) {
    return (
      <div className="daily-missions-container">
        <div className="loading-message">
          Loading daily missions...
        </div>
      </div>
    );
  }

  // FIXED: Use standardized date helper
  const getDueDateInfo = (mission) => {
    if (!mission.dueDate) return null;
    
    const status = getDueDateStatus(mission);
    const display = formatDueDateForUser(mission);
    
    return { status, display };
  };

  return (
    <div className="daily-missions-container">
      <div className="daily-missions-header">
        <h1 className="page-title">Set Daily Missions</h1>
        <p className="page-subtitle">
          What are your three most important priorities for the day?
        </p>
        
        {/* Show current status if daily missions are already set */}
        {currentDailyConfig && currentDailyConfig.isActive ? (
          <div className="current-status">
            <p className="status-text">
              ✅ Daily missions are currently active. You can update them below.
            </p>
            <p style={{ fontSize: '12px', color: '#666' }}>
              DEBUG: Config has {currentDailyConfig.selectedMissionIds?.length || 0} missions, 
              active: {String(currentDailyConfig.isActive)}
            </p>
          </div>
        ) : (
          <div className="current-status">
            <p className="status-text">
              No daily missions are currently active.
            </p>
            <p style={{ fontSize: '12px', color: '#666' }}>
              DEBUG: Config - {currentDailyConfig ? 
                `exists but inactive (${currentDailyConfig.isActive})` : 
                'does not exist'}
            </p>
          </div>
        )}
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
              // Filled slot with mission
              <div className="mission-slot-filled">
                <div className="mission-info">
                  <h3 className="mission-title">{mission.title}</h3>
                  <p className="mission-description">{mission.description || 'No description'}</p>
                  <div className="mission-badges">
                    <DifficultyBadge difficulty={mission.difficulty} />
                    
                    {/* FIXED: Use helper for date status */}
                    {mission.dueDate && getDueDateInfo(mission) && (
                      <span className={`due-date-badge ${getDueDateInfo(mission).status}`}>
                        {getDueDateInfo(mission).display}
                      </span>
                    )}
                    
                    {mission.skill && (
                      <span className="skill-badge">{mission.skill}</span>
                    )}
                    
                    {/* FIXED: Use helper for completion status */}
                    {isMissionCompleted(mission) && (
                      <span className="completed-badge">✓ Completed</span>
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
            ) : (
              // Empty slot - clickable
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
          {saving ? 'Setting Daily Missions...' : 'Set Daily Missions'}
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
    </div>
  );
};

export default EditDailyMissionsPage;