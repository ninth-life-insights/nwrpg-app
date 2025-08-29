// src/components/missions/MissionList.js
import React, { useState } from 'react';

import './MissionList.css';

import MissionCard from './MissionCard';
import { mockMissions } from '../../data/mockMissions';
import MissionDetailView from './MissionCardFull';
import AddMissionCard from './AddMissionCard';

const MissionList = () => {
  // State to manage our missions
  const [missions, setMissions] = useState(mockMissions);
  
  // State to manage selected mission for detail view
  const [selectedMission, setSelectedMission] = useState(null);
  
  // State to manage add mission form
  const [showAddMission, setShowAddMission] = useState(false);

  // Function to toggle completion status
  const handleToggleComplete = (missionId) => {
    setMissions(prevMissions => 
      prevMissions.map(mission => 
        mission.id === missionId 
          ? { ...mission, completed: !mission.completed }
          : mission
      )
    );
  };

  // Function to add new mission
  const handleAddMission = (newMission) => {
    setMissions(prevMissions => [newMission, ...prevMissions]);
    setShowAddMission(false);
  };

  return (
    <div className="">
      <div className="mission-list-header">
        <h1 className="">
          Mission Bank
        </h1>
        <button 
          onClick={() => setShowAddMission(true)}
          className="add-mission-button"
        >
          + Add Mission
        </button>
      </div>

      <div style={{textAlign: 'center'}}>
        {missions.map(mission => (
          <MissionCard
            key={mission.id}
            mission={mission}
            onToggleComplete={handleToggleComplete}
            onViewDetails={setSelectedMission}
          />
        ))}
      </div>

      {/* Mission Detail View */}
      {selectedMission && (
        <MissionDetailView 
          mission={selectedMission} 
          onClose={() => setSelectedMission(null)} 
          onToggleComplete={handleToggleComplete} 
        />
      )}

      {/* Add Mission Form */}
      {showAddMission && (
        <AddMissionCard
          onAddMission={handleAddMission}
          onCancel={() => setShowAddMission(false)}
        />
      )}
    </div>
  );
};

export default MissionList;