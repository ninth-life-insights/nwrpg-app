// src/pages/EditDailyMissionsPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AddMissionCard from '../components/missions/AddMissionCard';
import MissionList from '../components/missions/MissionList';
import { 
  getActiveMissions, 
  updateMission,
  getDailyMissionsConfig,
  setDailyMissions as saveDailyMissions,
  clearDailyMissionStatus 
} from '../services/missionService';
import './EditDailyMissionsPage.css';

const EditDailyMissionsPage = () => {
  const { currentUser } = useAuth();
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
      setCurrentDailyConfig(config);
      
      if (config && config.selectedMissionIds && config.isActive) {
        // Load the actual mission data for each selected mission
        const allMissions = await getActiveMissions(currentUser.uid);
        const selectedMissions = config.selectedMissionIds.map(missionId => 
          allMissions.find(mission => mission.id === missionId)
        ).filter(Boolean); // Remove any null/undefined missions
        
        // Fill the slots with the selected missions
        const newDailyMissions = [...dailyMissions];
        selectedMissions.forEach((mission, index) => {
          if (index < 3) {
            newDailyMissions[index] = mission;
          }
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

  // Handle adding a new mission to a specific slot
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

  // Handle adding new mission - finds first empty slot
  const handleAddNewMission = () => {
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

  // Handle setting daily missions (save functionality)
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
      
      // Clear daily status from previously selected missions if they exist
      if (currentDailyConfig && currentDailyConfig.selectedMissionIds) {
        const currentMissionIds = validMissions.map(m => m.id);
        const previousMissions = currentDailyConfig.selectedMissionIds.filter(
          id => !currentMissionIds.includes(id)
        );
        
        if (previousMissions.length > 0) {
          await clearDailyMissionStatus(currentUser.uid, previousMissions);
        }
      }
      
      // Extract mission IDs
      const selectedMissionIds = validMissions.map(mission => mission.id);
      
      // Save the daily missions configuration
      await saveDailyMissions(currentUser.uid, selectedMissionIds);
      
      // Update the current config state
      setCurrentDailyConfig({
        selectedMissionIds,
        isActive: true,
        lastResetDate: new Date()
      });
      
      alert('Daily missions set successfully! Your 3 daily missions are now active.');
      
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

  return (
    <div className="daily-missions-container">
      <div className="daily-missions-header">
        <h1 className="page-title">Set Daily Missions</h1>
        <p className="page-subtitle">
          What are your three most important priorities for the day?
        </p>
        
        {/* Show current status if daily missions are already set */}
        {currentDailyConfig && currentDailyConfig.isActive && (
          <div className="current-status">
            <p className="status-text">
              ✅ Daily missions are currently active. You can update them below.
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
                  <p className="mission-description">{mission.description}</p>
                  <div className="mission-badges">
                    {mission.skill && (
                      <span className="skill-badge">{mission.skill}</span>
                    )}
                    {mission.dueDate && (
                      <span className="due-date-badge">
                        Due: {new Date(mission.dueDate.seconds * 1000).toLocaleDateString()}
                      </span>
                    )}
                    {mission.isDailyMission && (
                      <span className="daily-badge">Daily Mission</span>
                    )}
                  </div>
                </div>
                <button 
                  className="remove-mission-btn"
                  onClick={() => handleRemoveMission(index)}
                  title="Remove mission"
                >
                  −
                </button>
              </div>
            ) : (
              // Empty slot
              <div className="mission-slot-empty">
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
          onClick={handleAddNewMission}
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
          onAddMission={(mission) => handleMissionSelect(mission)}
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