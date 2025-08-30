// src/components/missions/MissionList.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import MissionCard from './MissionCard';
import MissionDetailView from './MissionCardFull';
import AddMissionCard from './AddMissionCard';
import { 
  getActiveMissions, 
  getCompletedMissions, 
  completeMission, 
  uncompleteMission 
} from '../../services/missionService';
import { addXP, subtractXP, getUserProfile } from '../../services/userService';

const MissionList = () => {
  const { currentUser } = useAuth();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);
  const [showAddMission, setShowAddMission] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'completed'

  // Load missions and user profile when component mounts or user changes
  useEffect(() => {
    if (currentUser) {
      loadMissions();
      loadUserProfile();
    }
  }, [currentUser, activeTab]);

  const loadMissions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let missionData;
      if (activeTab === 'active') {
        missionData = await getActiveMissions(currentUser.uid);
      } else {
        missionData = await getCompletedMissions(currentUser.uid);
      }
      
      setMissions(missionData);
    } catch (err) {
      console.error('Error loading missions:', err);
      setError('Failed to load missions');
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const profile = await getUserProfile(currentUser.uid);
      setUserProfile(profile);
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  };

  // Function to toggle completion status with XP handling
  const handleToggleComplete = async (missionId, isCurrentlyCompleted, xpReward) => {
    try {
      if (isCurrentlyCompleted) {
        // Uncomplete the mission
        await uncompleteMission(currentUser.uid, missionId);
        if (xpReward) {
          await subtractXP(currentUser.uid, xpReward);
        }
      } else {
        // Complete the mission
        await completeMission(currentUser.uid, missionId);
        if (xpReward) {
          const result = await addXP(currentUser.uid, xpReward);
          
          // Show level up notification if applicable
          if (result && result.leveledUp) {
            // You can add a toast notification here later
            console.log(`Level up! Now level ${result.newLevel}`);
          }
        }
      }

      // Refresh missions and user profile
      loadMissions();
      loadUserProfile();
      
      // Close detail view if it was open
      setSelectedMission(null);
      
    } catch (err) {
      console.error('Error toggling mission:', err);
      setError('Failed to update mission');
    }
  };

  const handleAddMission = (newMission) => {
    // Add the new mission to the current list if we're on active tab
    if (activeTab === 'active') {
      setMissions(prev => [newMission, ...prev]);
    }
    
    setShowAddMission(false);
    loadUserProfile(); // Refresh in case any XP changed
  };

  if (!currentUser) {
    return <div>Please log in to view your missions.</div>;
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>Loading missions...</div>;
  }

  return (
    <div className="">
      {/* User Profile Section */}
      {userProfile && (
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: '#f0f0f0',
          borderRadius: '8px'
        }}>
          <h2>Level {userProfile.level}</h2>
          <p>XP: {userProfile.totalXP} | Current XP: {userProfile.currentXP}</p>
          <p>Welcome back, {userProfile.displayName}!</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        marginBottom: '20px',
        gap: '10px'
      }}>
        <button
          onClick={() => setActiveTab('active')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'active' ? '#007bff' : '#e9ecef',
            color: activeTab === 'active' ? 'white' : '#333',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Active Missions ({missions.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'completed' ? '#007bff' : '#e9ecef',
            color: activeTab === 'completed' ? 'white' : '#333',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Completed
        </button>
      </div>

      {/* Header with Add Button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1>
          {activeTab === 'active' ? 'Active Missions' : 'Completed Missions'}
        </h1>
        
        {activeTab === 'active' && (
          <button
            onClick={() => setShowAddMission(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            + Add Mission
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ 
          color: 'red', 
          textAlign: 'center', 
          padding: '10px',
          backgroundColor: '#ffe6e6',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* Missions List */}
      <div style={{ textAlign: 'center' }}>
        {missions.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px',
            color: '#666'
          }}>
            {activeTab === 'active' 
              ? "No active missions. Add your first mission to get started!" 
              : "No completed missions yet. Complete some active missions to see them here!"
            }
          </div>
        ) : (
          missions.map(mission => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onToggleComplete={handleToggleComplete}
              onViewDetails={setSelectedMission}
            />
          ))
        )}
      </div>

      {/* Mission Detail Modal */}
      {selectedMission && (
        <MissionDetailView 
          mission={selectedMission} 
          onClose={() => setSelectedMission(null)} 
          onToggleComplete={handleToggleComplete} 
        />
      )}

      {/* Add Mission Modal */}
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