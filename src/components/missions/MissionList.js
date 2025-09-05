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
import { MISSION_STATUS } from '../../types/Mission';

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
      
      // Filter out any missions with missing IDs and log them
      const validMissions = missionData.filter(mission => {
        if (!mission.id) {
          console.error('Mission found without ID:', mission);
          return false;
        }
        return true;
      });
      
      setMissions(validMissions);
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

  // Function to toggle completion status with XP and SP handling
  const handleToggleComplete = async (missionId, isCurrentlyCompleted, xpReward, spReward) => {
    try {
      console.log('Toggling completion for mission:', missionId, { isCurrentlyCompleted, xpReward, spReward });
      
      // Validate mission ID
      if (!missionId) {
        console.error('No mission ID provided');
        setError('Invalid mission ID');
        return;
      }

      if (isCurrentlyCompleted) {
        // Uncomplete the mission
        await uncompleteMission(currentUser.uid, missionId);
        
        // Subtract rewards
        if (xpReward && xpReward > 0) {
          await subtractXP(currentUser.uid, xpReward);
        }
        // if (spReward && spReward > 0) {
        //   await subtractSP(currentUser.uid, spReward);
        // }
      } else {
        // Complete the mission
        await completeMission(currentUser.uid, missionId);
        
        // Add rewards
        if (xpReward && xpReward > 0) {
          const result = await addXP(currentUser.uid, xpReward);
          
          // Show level up notification if applicable
          if (result && result.leveledUp) {
            console.log(`Level up! Now level ${result.newLevel}`);
            // TODO: Add toast notification here later
          }
        }
        // if (spReward && spReward > 0) {
        //   await addSP(currentUser.uid, spReward);
        // }
      }

      // Refresh missions and user profile
      await loadMissions();
      await loadUserProfile();
      
      // Close detail view if it was open
      setSelectedMission(null);
      
    } catch (err) {
      console.error('Error toggling mission:', err);
      setError('Failed to update mission. Please try again.');
    }
  };

  const handleAddMission = () => {
    // Close the add mission modal
    setShowAddMission(false);
    
    // Reload missions from Firebase (single source of truth)
    loadMissions();
    loadUserProfile(); // Refresh in case any XP changed
  };

  const handleViewDetails = (mission) => {
    if (!mission || !mission.id) {
      console.error('Invalid mission for details view:', mission);
      return;
    }
    setSelectedMission(mission);
  };

  if (!currentUser) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        color: '#666'
      }}>
        Please log in to view your missions.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        color: '#666'
      }}>
        Loading missions...
      </div>
    );
  }

  return (
    <div className="mission-list-container">
      {/* User Profile Section */}
      {userProfile && (
        <div className="user-profile-section">
          <h2>Level {userProfile.level}</h2>
          <div className="user-stats">
            <span className="stat-item">
              <strong>Total XP:</strong> {userProfile.totalXP || 0}
            </span>
            <span className="stat-item">
              <strong>Current XP:</strong> {userProfile.currentXP || 0}
            </span>
            {userProfile.totalSP && (
              <span className="stat-item">
                <strong>SP:</strong> {userProfile.totalSP}
              </span>
            )}
          </div>
          <p>Welcome back, {userProfile.displayName}!</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          onClick={() => setActiveTab('active')}
          className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
        >
          Active Missions ({missions.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`tab-button ${activeTab === 'completed' ? 'active' : ''}`}
        >
          Completed Missions
        </button>
      </div>

      {/* Header with Add Button */}
      <div className="mission-list-header">
        <h1>
          {activeTab === 'active' ? 'Active Missions' : 'Completed Missions'}
        </h1>
        
        {activeTab === 'active' && (
          <button
            onClick={() => setShowAddMission(true)}
            className="add-mission-button"
          >
            <span>+</span>
            Add Mission
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          {error}
          <button 
            onClick={() => setError(null)}
            className="error-dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Missions List */}
      <div className="missions-container">
        {missions.length === 0 ? (
          <div className="empty-state">
            {activeTab === 'active' 
              ? "No active missions. Add your first mission to get started!" 
              : "No completed missions yet. Complete some active missions to see them here!"
            }
          </div>
        ) : (
          missions.map((mission, index) => (
            <MissionCard
              key={mission.id || `mission-${index}`} // Fallback key for safety
              mission={mission}
              onToggleComplete={handleToggleComplete}
              onViewDetails={handleViewDetails}
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