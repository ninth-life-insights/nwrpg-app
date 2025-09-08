// src/components/missions/MissionList.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import MissionCard from './MissionCard';
import MissionDetailView from './MissionCardFull';
import AddMissionCard from './AddMissionCard';
import { 
  getActiveMissions, 
  getCompletedMissions,
  getExpiredMissions,
  completeMission, 
  uncompleteMission 
} from '../../services/missionService';
import { addXP, subtractXP } from '../../services/userService';

const MissionList = ({ 
  missionType = 'active', 
  onMissionUpdate,
  showAddMission,
  onShowAddMission,
  onHideAddMission,
  filters = {}
}) => {
  const { currentUser } = useAuth();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);

  // Load missions when component mounts, user changes, mission type changes, or filters change
  useEffect(() => {
    if (currentUser) {
      loadMissions();
    }
  }, [currentUser, missionType, filters]);

  const applyFiltersAndSort = (missionData, filterSettings) => {
    let filteredMissions = [...missionData];

    // Apply skill filter
    if (filterSettings.skillFilter && filterSettings.skillFilter !== '') {
      filteredMissions = filteredMissions.filter(mission => 
        mission.skill === filterSettings.skillFilter
      );
    }

    // Sort missions
    filteredMissions.sort((a, b) => {
      let comparison = 0;
      
      switch (filterSettings.sortBy) {
        case 'dueDate':
          // Handle due date sorting - null values go to end
          const aDate = a.dueDate ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate)) : null;
          const bDate = b.dueDate ? (b.dueDate.toDate ? b.dueDate.toDate() : new Date(b.dueDate)) : null;
          
          if (!aDate && !bDate) {
            // Both have no due date, sort by creation date
            const aCreated = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bCreated = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            comparison = aCreated - bCreated;
          } else if (!aDate) {
            comparison = 1; // a goes after b
          } else if (!bDate) {
            comparison = -1; // a goes before b
          } else {
            comparison = aDate - bDate;
          }
          break;
          
        case 'createdAt':
          const aCreated = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const bCreated = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          comparison = aCreated - bCreated;
          break;
          
        case 'difficulty':
          const difficultyOrder = { 'easy': 1, 'medium': 2, 'hard': 3 };
          comparison = (difficultyOrder[a.difficulty] || 2) - (difficultyOrder[b.difficulty] || 2);
          break;
          
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
          
        default:
          comparison = 0;
      }
      
      return filterSettings.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filteredMissions;
  };

  const loadMissions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let missionData = [];
      
      if (missionType === 'all') {
        // Load all mission types
        const [activeData, completedData, expiredData] = await Promise.all([
          getActiveMissions(currentUser.uid),
          getCompletedMissions(currentUser.uid),
          getExpiredMissions(currentUser.uid).catch(() => []) // Handle if function doesn't exist
        ]);
        missionData = [...activeData, ...completedData, ...expiredData];
      } else if (missionType === 'active') {
        missionData = await getActiveMissions(currentUser.uid);
      } else if (missionType === 'completed') {
        missionData = await getCompletedMissions(currentUser.uid);
      } else if (missionType === 'expired') {
        try {
          missionData = await getExpiredMissions(currentUser.uid);
        } catch (err) {
          console.warn('getExpiredMissions not available:', err);
          missionData = [];
        }
      }
      
      // Apply filtering and sorting
      const processedMissions = applyFiltersAndSort(missionData, filters);
      setMissions(processedMissions);
    } catch (err) {
      console.error('Error loading missions:', err);
      setError('Failed to load missions');
    } finally {
      setLoading(false);
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
      
      // Reload missions to reflect changes
      await loadMissions();
      
      // Notify parent component of the update
      if (onMissionUpdate) {
        onMissionUpdate();
      }
    } catch (err) {
      console.error('Error toggling mission completion:', err);
      setError('Failed to update mission');
    }
  };

  // Handle adding a new mission
  const handleAddMission = async (newMission) => {
    // Reload missions to include the new one
    await loadMissions();
    
    // Hide the add mission modal
    if (onHideAddMission) {
      onHideAddMission();
    }
    
    // Notify parent component
    if (onMissionUpdate) {
      onMissionUpdate();
    }
  };

  // Loading state
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

  // Error state
  if (error) {
    return (
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
    );
  }

  // Empty state
  if (missions.length === 0) {
    const emptyMessage = missionType === 'active' 
      ? "No active missions. Add your first mission to get started!" 
      : "No completed missions yet. Complete some active missions to see them here!";
      
    return (
      <div>
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          color: '#666'
        }}>
          {emptyMessage}
        </div>
        
        {/* Add Mission Modal */}
        {showAddMission && (
          <AddMissionCard
            onAddMission={handleAddMission}
            onCancel={onHideAddMission}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mission-list">
      {/* Missions Grid */}
      <div style={{ textAlign: 'center' }}>
        {missions.map(mission => (
          <MissionCard
            key={mission.id}
            mission={mission}
            onToggleComplete={handleToggleComplete}
            onViewDetails={setSelectedMission}
          />
        ))}
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
          onCancel={onHideAddMission}
        />
      )}
    </div>
  );
};

export default MissionList;