// src/components/missions/MissionList.js
import React, { useState } from 'react';
import MissionCard from './MissionCard';
import { mockMissions } from '../../data/mockMissions';
import MissionDetailView from './MissionCardFull';

const MissionList = () => {
  // State to manage our missions
  const [missions, setMissions] = useState(mockMissions);

  const [selectedMission, setSelectedMission] = useState(null);

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

  return (
    <div className="">
      <h1 className="">
        Mission Bank
      </h1>

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

      {selectedMission && (
        <MissionDetailView 
          mission={selectedMission} 
          onClose={() => setSelectedMission(null)} 
          onToggleComplete={handleToggleComplete} 
        />
      )}

    </div>
  );
};

export default MissionList;
