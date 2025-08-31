// src/pages/EditDailyMissionsPage.js
import React, { useState } from 'react';
import AddMissionCard from '../components/missions/AddMissionCard';
import MissionList from '../components/missions/MissionList';
import './EditDailyMissionsPage.css';

const EditDailyMissionsPage = () => {
  const [dailyMissions, setDailyMissions] = useState([null, null, null]);
  const [showAddMission, setShowAddMission] = useState(false);
  const [showMissionBank, setShowMissionBank] = useState(false);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);

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
  const handleSetDailyMissions = () => {
    // TODO: Implement save functionality
    console.log('Setting daily missions:', dailyMissions);
    // This would typically call a service to save the daily missions
    // For now, just log the missions
    alert('Daily missions set successfully!');
  };

  // Check if all slots are filled
  const allSlotsFilled = dailyMissions.every(mission => mission !== null);

  return (
    <div className="daily-missions-container">
      <div className="daily-missions-header">
        <h1 className="page-title">Set Daily Missions</h1>
        <p className="page-subtitle">
          What are your three most important priorities for the day?
        </p>
      </div>

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
                    <span className="xp-badge">+{mission.xpReward || 50} XP</span>
                    {mission.skill && (
                      <span className="skill-badge">{mission.skill}</span>
                    )}
                  </div>
                </div>
                <button 
                  className="remove-mission-btn"
                  onClick={() => handleRemoveMission(index)}
                  title="Remove mission"
                >
                  ×
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
          disabled={allSlotsFilled}
        >
          + Add New Mission
        </button>
        
        <button 
          className="action-btn secondary"
          onClick={handleChooseFromBank}
          disabled={allSlotsFilled}
        >
          📋 Choose from Mission Bank
        </button>
      </div>

      {/* Set Daily Missions Button */}
      <div className="set-missions-section">
        <button 
          className={`set-missions-btn ${allSlotsFilled ? 'enabled' : 'disabled'}`}
          onClick={handleSetDailyMissions}
          disabled={!allSlotsFilled}
        >
          Set Daily Missions
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
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EditDailyMissionsPage;