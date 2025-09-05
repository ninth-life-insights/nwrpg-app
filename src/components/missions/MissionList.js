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

const MissionList = ({ 
  selectionMode = false, 
  onMissionSelect = null,
  selectedMissions = [],
  maxSelections = null 
}) => {
  const { currentUser } = useAuth();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);
  const [showAddMission, setShowAddMission] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('active');

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
    if (selectionMode) return; // Don't allow completion toggle in selection mode
    
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

  const handleAddMission = () => {
  setShowAddMission(false);
  // Just reload missions from Firebase instead of manually adding
  loadMissions();
  loadUserProfile(); // Refresh in case any XP changed
};

  // Handle mission selection for daily missions
  const handleMissionSelect = (mission) => {
    if (!selectionMode || !onMissionSelect) return;
    
    // Check if mission is already selected
    const isSelected = selectedMissions.some(selected => selected.id === mission.id);
    
    if (isSelected) {
      // Mission is already selected, don't allow deselection here
      return;
    }
    
    // Check if we've reached max selections
    if (maxSelections && selectedMissions.length >= maxSelections) {
      alert(`You can only select up to ${maxSelections} missions.`);
      return;
    }
    
    // Select the mission
    onMissionSelect(mission);
  };

  // Handle viewing mission details
  const handleViewDetails = (mission) => {
    if (selectionMode) {
      handleMissionSelect(mission);
    } else {
      setSelectedMission(mission);
    }
  };

  if (!currentUser) {
    return <div>Please log in to view your missions.</div>;
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>Loading missions...</div>;
  }

  return (
    <div className={selectionMode ? 'mission-list-selection-mode' : ''}>
      {/* Only show user profile and tabs if not in selection mode */}
      {!selectionMode && userProfile && (
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

      {/* Tab Navigation - hidden in selection mode */}
      {!selectionMode && (
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
      )}

      {/* Header with Add Button - hidden in selection mode */}
      {!selectionMode && (
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
      )}

      {/* Selection mode header */}
      {selectionMode && (
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          border: '2px solid #2196f3'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>
            Select a Mission for Daily Assignment
          </h3>
          <p style={{ margin: 0, color: '#1976d2', fontSize: '14px' }}>
            {maxSelections && selectedMissions.length > 0 
              ? `${selectedMissions.length}/${maxSelections} selected`
              : 'Click on a mission to add it to your daily missions'
            }
          </p>
        </div>
      )}

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
            {selectionMode 
              ? "No missions available. Add some missions to your collection first!"
              : activeTab === 'active' 
                ? "No active missions. Add your first mission to get started!" 
                : "No completed missions yet. Complete some active missions to see them here!"
            }
          </div>
        ) : (
          missions.map(mission => {
            const isSelected = selectionMode && selectedMissions.some(selected => selected.id === mission.id);
            
            return (
              <div
                key={mission.id}
                className={`mission-wrapper ${selectionMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
                style={{
                  position: 'relative',
                  ...(selectionMode && {
                    cursor: 'pointer',
                    padding: '4px',
                    margin: '8px auto',
                    maxWidth: '400px',
                    borderRadius: '12px',
                    border: isSelected ? '3px solid #2196f3' : '3px solid transparent',
                    backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
                    transition: 'all 0.2s ease'
                  })
                }}
                onClick={selectionMode ? () => handleMissionSelect(mission) : undefined}
              >
                {isSelected && selectionMode && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#2196f3',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    zIndex: 10
                  }}>
                    ✓
                  </div>
                )}
                <MissionCard
                  mission={mission}
                  onToggleComplete={handleToggleComplete}
                  onViewDetails={handleViewDetails}
                  selectionMode={selectionMode}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Mission Detail Modal - hidden in selection mode */}
      {!selectionMode && selectedMission && (
        <MissionDetailView 
          mission={selectedMission} 
          onClose={() => setSelectedMission(null)} 
          onToggleComplete={handleToggleComplete} 
        />
      )}

      {/* Add Mission Modal - hidden in selection mode */}
      {!selectionMode && showAddMission && (
        <AddMissionCard
          onAddMission={handleAddMission}
          onCancel={() => setShowAddMission(false)}
        />
      )}
    </div>
  );
};

export default MissionList;