// src/components/missions/MissionList.js
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import MissionCard from './MissionCard';
import MissionDetailView from './MissionCardFull';
import AddMissionCard from './AddMissionCard';
import { 
  getActiveMissions, 
  getCompletedMissions,
  getExpiredMissions,
  completeMission, 
  uncompleteMission,
  checkAndHandleDailyMissionReset
} from '../../services/missionService';
import { addXP, subtractXP } from '../../services/userService';

const MissionList = ({ 
  missionType = 'active', 
  onMissionUpdate,
  showAddMission,
  onHideAddMission,
  filters = {},
  selectionMode = false, 
  onMissionSelect = null,
  selectedMissions = [],
  maxSelections = null,
  recentlyCompletedMissions = [],
  onMissionCompletion = null,
  onMissionUncompletion = null
}) => {
  const { currentUser } = useAuth();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);

  // Memoize the filters to prevent unnecessary re-renders
  const memoizedFilters = useMemo(() => ({
    sortBy: filters.sortBy || 'dueDate',
    sortOrder: filters.sortOrder || 'asc',
    skillFilter: filters.skillFilter || ''
  }), [filters.sortBy, filters.sortOrder, filters.skillFilter]);

  // Load missions when component mounts, user changes, mission type changes, or filters change
  useEffect(() => {
    if (currentUser) {
      loadMissions();
    }
  }, [currentUser, missionType, memoizedFilters]);

  const applyFiltersAndSort = (missionData, filterSettings) => {
    let filteredMissions = [...missionData];

    // Apply skill filter
    if (filterSettings.skillFilter && filterSettings.skillFilter !== '') {
      filteredMissions = filteredMissions.filter(mission => 
        mission.skill === filterSettings.skillFilter
      );
    }

    // Sort missions - filterSettings is now guaranteed to have values
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
          // Fallback to dueDate if unknown sortBy
          const aDateDefault = a.dueDate ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate)) : null;
          const bDateDefault = b.dueDate ? (b.dueDate.toDate ? b.dueDate.toDate() : new Date(b.dueDate)) : null;
          
          if (!aDateDefault && !bDateDefault) {
            const aCreatedDefault = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bCreatedDefault = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            comparison = aCreatedDefault - bCreatedDefault;
          } else if (!aDateDefault) {
            comparison = 1;
          } else if (!bDateDefault) {
            comparison = -1;
          } else {
            comparison = aDateDefault - bDateDefault;
          }
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
      
      // Apply filtering and sorting - now using memoizedFilters
      const processedMissions = applyFiltersAndSort(missionData, memoizedFilters);
      setMissions(processedMissions);
    } catch (err) {
      console.error('Error loading missions:', err);
      setError('Failed to load missions');
    } finally {
      setLoading(false);
    }
  };

  // reset daily missions if expired
  useEffect(() => {
    const handleDailyReset = async () => {
      if (currentUser) {
        const result = await checkAndHandleDailyMissionReset(currentUser.uid);
        if (result.wasReset) {
          // Optionally show user notification
          console.log(`Daily missions reset. Archived ${result.archivedCount} missions from ${result.archivedDate}`);
          // Refresh your daily missions data
          await loadMissions();
        }
      }
    };
    
    handleDailyReset();
  }, [currentUser]);
  
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
        
        // Notify parent about uncompletion
        if (onMissionUncompletion) {
          onMissionUncompletion(missionId);
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
        
        // Find the completed mission and notify parent
        const completedMission = missions.find(mission => mission.id === missionId);
        if (completedMission && onMissionCompletion) {
          // Update the mission status for the parent
          const updatedMission = { ...completedMission, status: 'completed' };
          onMissionCompletion(updatedMission);
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
  const handleAddMission = (newMission) => {
    if (!newMission.id) {
      console.error('BLOCKING: Cannot add mission without ID');
      console.error('Mission object:', newMission);
      return; // Don't add missions without IDs
    }

    setMissions(prev => {
      const newMissions = [newMission, ...prev];
      return newMissions;
    });
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

  // Combine and organize missions for display
  const getDisplayMissions = () => {
    // Remove recently completed missions from the main list to avoid duplicates
    const recentlyCompletedIds = recentlyCompletedMissions.map(mission => mission.id);
    const filteredMissions = missions.filter(mission => !recentlyCompletedIds.includes(mission.id));
    
    // Only show recently completed for active missions view
    if (missionType === 'active') {
      return [...recentlyCompletedMissions, ...filteredMissions];
    }
    
    // For other views, just show the regular missions
    return missions;
  };

  const displayMissions = getDisplayMissions();

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
  if (displayMissions.length === 0) {
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
    <div className={selectionMode ? 'mission-list-selection-mode' : 'mission-list'}>

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
            Assign to Daily Missions
          </h3>
          <p style={{ margin: 0, color: '#1976d2', fontSize: '14px' }}>
            {maxSelections && selectedMissions.length > 0 
              ? `${selectedMissions.length}/${maxSelections} selected`
              : 'Click on a mission to add it to your daily missions'
            }
          </p>
        </div>
      )}


      {/* Missions Grid */}
      <div style={{ textAlign: 'center' }}>
        {displayMissions.map((mission, index) => {
          const isSelected = selectionMode && selectedMissions.some(selected => selected.id === mission.id);
          const isRecentlyCompleted = recentlyCompletedMissions.some(completed => completed.id === mission.id);
          
          return (
            <div
              key={mission.id}
              className={`mission-wrapper ${selectionMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''} ${isRecentlyCompleted ? 'recently-completed' : ''}`}
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
                }),
                ...(isRecentlyCompleted && {
                  marginBottom: index === recentlyCompletedMissions.length - 1 ? '25px' : '8px'
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
                key={mission.id}
                mission={mission}
                onToggleComplete={handleToggleComplete}
                onViewDetails={handleViewDetails}
                selectionMode={selectionMode}
                isRecentlyCompleted={isRecentlyCompleted}
              />
            </div>
          );
        })}
      </div>

      {/* Mission Detail Modal */}
       {!selectionMode && selectedMission && (
        <MissionDetailView 
          mission={selectedMission} 
          onClose={() => setSelectedMission(null)} 
          onToggleComplete={handleToggleComplete} 
        />
      )}

      {/* Add Mission Modal */}
      {!selectionMode && showAddMission && (
        <AddMissionCard
          onAddMission={handleAddMission}
          onCancel={onHideAddMission}
        />
      )}
    </div>
  );
};

export default MissionList;