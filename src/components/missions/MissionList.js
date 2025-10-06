// src/components/missions/MissionList.js - WITH DRAG AND DROP
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
  completeMissionWithRecurrence,
  deleteMission,
  updateMissionCustomOrder,
  batchUpdateMissionOrders
} from '../../services/missionService';

import { 
  addDailyMissionStatus 
} from '../../services/dailyMissionService';

import { addXP, subtractXP } from '../../services/userService';
import { isRecurringMission } from '../../utils/recurrenceHelpers';

import { isWithinCompletedDateRange } from './sub-components/MissionFilterModal';
import { calculateTotalMissionXP } from '../../types/Mission';

// Drag and drop imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

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
  onMissionUncompletion = null,
  onRecurringMissionCreated = null
}) => {
  const { currentUser } = useAuth();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);
  const [showDragPrompt, setShowDragPrompt] = useState(false);
  const [dragPromptPosition, setDragPromptPosition] = useState(null);
  const [hasInitializedCustomOrder, setHasInitializedCustomOrder] = useState(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(PointerSensor, { // Only for desktop
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const memoizedFilters = useMemo(() => ({
    sortBy: filters.sortBy || 'dueDate',
    sortOrder: filters.sortOrder || 'asc',
    skillFilter: filters.skillFilter || '',
    includeCompleted: filters.includeCompleted || false,
    includeExpired: filters.includeExpired || false,
    completedDateRange: filters.completedDateRange || 'last7days'
  }), [filters.sortBy, filters.sortOrder, filters.skillFilter, filters.includeCompleted, filters.includeExpired, filters.completedDateRange]);

  const isCustomOrderMode = memoizedFilters.sortBy === 'custom';

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

    // Apply completed date range filter
    if (filterSettings.includeCompleted && filterSettings.completedDateRange) {
      filteredMissions = filteredMissions.filter(mission => {
        if (mission.status !== 'completed') {
          return true;
        }
        return isWithinCompletedDateRange(mission, filterSettings.completedDateRange);
      });
    }

    // Sort missions
    filteredMissions.sort((a, b) => {
      let comparison = 0;
      
      switch (filterSettings.sortBy) {
        case 'custom':
          // Custom order: missions with customSortOrder first, then new missions at top (by createdAt desc)
          const aHasOrder = a.customSortOrder !== null && a.customSortOrder !== undefined;
          const bHasOrder = b.customSortOrder !== null && b.customSortOrder !== undefined;
          
          if (aHasOrder && bHasOrder) {
            comparison = a.customSortOrder - b.customSortOrder;
          } else if (aHasOrder) {
            comparison = 1; // a has order, goes after b (new missions at top)
          } else if (bHasOrder) {
            comparison = -1; // b has order, a goes before (new missions at top)
          } else {
            // Both are new, sort by creation date (newest first)
            const aCreated = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bCreated = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            comparison = bCreated - aCreated; // Descending for new missions
          }
          break;
          
        case 'dueDate':
          const aDate = a.dueDate ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate)) : null;
          const bDate = b.dueDate ? (b.dueDate.toDate ? b.dueDate.toDate() : new Date(b.dueDate)) : null;
          
          if (!aDate && !bDate) {
            const aCreated = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bCreated = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            comparison = aCreated - bCreated;
          } else if (!aDate) {
            comparison = 1;
          } else if (!bDate) {
            comparison = -1;
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
        const [activeData, completedData, expiredData] = await Promise.all([
          getActiveMissions(currentUser.uid),
          getCompletedMissions(currentUser.uid),
          getExpiredMissions(currentUser.uid).catch(() => [])
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
      
      const missionsWithDailyStatus = await addDailyMissionStatus(currentUser.uid, missionData);
      const processedMissions = applyFiltersAndSort(missionsWithDailyStatus, memoizedFilters);
      setMissions(processedMissions);
    } catch (err) {
      console.error('Error loading missions:', err);
      setError('Failed to load missions');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (missionId, isCurrentlyCompleted, xpReward) => {
    if (selectionMode) return;

    try {
      if (isCurrentlyCompleted) {
        await uncompleteMission(currentUser.uid, missionId);
        
        if (onMissionUncompletion) {
          onMissionUncompletion(missionId);
        }
      } else {
        const completedMission = missions.find(mission => mission.id === missionId);
        
        const result = await completeMissionWithRecurrence(currentUser.uid, missionId);

        if (result.nextMissionCreated && onRecurringMissionCreated) {
          onRecurringMissionCreated({
            originalMissionId: missionId,
            nextMissionId: result.nextMissionId,
            nextDueDate: result.nextDueDate,
            missionTitle: completedMission.title
          });
        }

        if (completedMission && onMissionCompletion) {
          const updatedMission = { ...completedMission, status: 'completed', xpAwarded: result.xpAwarded };
          onMissionCompletion(updatedMission);
        }
      }
      
      await loadMissions();
      
      if (onMissionUpdate) {
        onMissionUpdate();
      }
    } catch (err) {
      console.error('Error toggling mission completion:', err);
      setError('Failed to update mission');
    }
  };

  const handleAddMission = (newMission) => {
    if (!newMission.id) {
      console.error('BLOCKING: Cannot add mission without ID');
      console.error('Mission object:', newMission);
      return;
    }

    const enhanceMissionWithDailyStatus = async () => {
      try {
        const enhancedMissions = await addDailyMissionStatus(currentUser.uid, [newMission]);
        const enhancedMission = enhancedMissions[0];
        
        setMissions(prev => {
          const newMissions = [enhancedMission, ...prev];
          return newMissions;
        });
      } catch (error) {
        console.error('Error enhancing mission with daily status:', error);
        setMissions(prev => {
          const newMissions = [{...newMission, isDailyMission: false}, ...prev];
          return newMissions;
        });
      }
    };

    enhanceMissionWithDailyStatus();
  };

  const handleMissionSelect = (mission) => {
    if (!selectionMode || !onMissionSelect) return;
    
    const isSelected = selectedMissions.some(selected => selected.id === mission.id);
    
    if (isSelected) {
      return;
    }
    
    if (maxSelections && selectedMissions.length >= maxSelections) {
      alert(`You can only select up to ${maxSelections} missions.`);
      return;
    }
    
    onMissionSelect(mission);
  };

  const handleViewDetails = (mission) => {
    if (selectionMode) {
      handleMissionSelect(mission);
    } else {
      setSelectedMission(mission);
    }
  };

  const handleDeleteMission = async (missionId) => {
    try {
      await deleteMission(currentUser.uid, missionId);
      setSelectedMission(null);
      await loadMissions();

      if (onMissionUpdate) {
        onMissionUpdate();
      }
    } catch (error) {
      console.error('Failed to delete mission:', error);
    }
  };

  const handleUpdateMission = (updatedMission) => {
  // Update the mission in local state
  setMissions(prevMissions =>
    prevMissions.map(m =>
      m.id === updatedMission.id ? updatedMission : m
    )
  );

  // If this is the currently selected mission, update that too
  if (selectedMission && selectedMission.id === updatedMission.id) {
    setSelectedMission(updatedMission);
  }

  // Notify parent component if needed
  if (onMissionUpdate) {
    onMissionUpdate();
  }
};

  // Initialize custom order when first switching to custom mode
  const initializeCustomOrder = async () => {
    if (hasInitializedCustomOrder) return;
    
    try {
      const updates = missions.map((mission, index) => ({
        missionId: mission.id,
        customSortOrder: index
      }));
      
      await batchUpdateMissionOrders(currentUser.uid, updates);
      
      // Update local state
      const updatedMissions = missions.map((mission, index) => ({
        ...mission,
        customSortOrder: index
      }));
      setMissions(updatedMissions);
      setHasInitializedCustomOrder(true);
    } catch (error) {
      console.error('Error initializing custom order:', error);
    }
  };

  // Handle drag start
  const handleDragStart = (event) => {
    if (!isCustomOrderMode) {
      // Show prompt
      setDragPromptPosition(event.active.id);
      setShowDragPrompt(true);
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setShowDragPrompt(false);
      }, 5000);
    }
  };

  // Handle drag end
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!isCustomOrderMode) {
      return;
    }

    if (active.id !== over.id) {
      // Initialize custom order on first drag if needed
      if (!hasInitializedCustomOrder) {
        await initializeCustomOrder();
      }

      const oldIndex = missions.findIndex((mission) => mission.id === active.id);
      const newIndex = missions.findIndex((mission) => mission.id === over.id);

      const reorderedMissions = arrayMove(missions, oldIndex, newIndex);
      
      // Update local state immediately for responsiveness
      setMissions(reorderedMissions);

      // Update just the dragged mission's order in Firestore
      try {
        await updateMissionCustomOrder(currentUser.uid, active.id, newIndex);
        
        // Update all affected missions in local state
        const updates = reorderedMissions.map((mission, index) => ({
          ...mission,
          customSortOrder: index
        }));
        setMissions(updates);
        
      } catch (error) {
        console.error('Error updating mission order:', error);
        // Revert on error
        await loadMissions();
      }
    }
  };

  const handleSwitchToCustomOrder = () => {
    setShowDragPrompt(false);
    // Trigger filter update through parent
    if (onMissionUpdate) {
      // This is a bit of a hack - we'd need to add a new prop to properly update filters
      // For now, close the prompt and let user manually switch
      alert('Please switch to "Custom Order" in the filter menu to reorder missions.');
    }
  };

  const getDisplayMissions = () => {
    const recentlyCompletedIds = recentlyCompletedMissions.map(mission => mission.id);
    const filteredMissions = missions.filter(mission => !recentlyCompletedIds.includes(mission.id));
    
    if (missionType === 'active') {
      return [...recentlyCompletedMissions, ...filteredMissions];
    }
    
    return missions;
  };

  const displayMissions = getDisplayMissions();

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

      {/* Missions Grid with Drag and Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={displayMissions.map(m => m.id)}
          strategy={verticalListSortingStrategy}
          disabled={!isCustomOrderMode || selectionMode}
        >
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
                  {/* Drag Prompt - appears near the mission that was attempted to drag */}
                  {showDragPrompt && dragPromptPosition === mission.id && (
                    <div className="drag-prompt-inline">
                      <button 
                        className="drag-prompt-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDragPrompt(false);
                        }}
                      >
                        ×
                      </button>
                      <div className="drag-prompt-content">
                        <p className="drag-prompt-text">
                          Switch to Custom Order to reorder missions
                        </p>
                        <button 
                          className="drag-prompt-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSwitchToCustomOrder();
                          }}
                        >
                          Open Filters
                        </button>
                      </div>
                    </div>
                  )}
                  
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
                    isCustomOrderMode={isCustomOrderMode}
                  />
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {!selectionMode && selectedMission && (
        <MissionDetailView 
          mission={selectedMission} 
          onClose={() => setSelectedMission(null)} 
          onToggleComplete={handleToggleComplete} 
          onDeleteMission={handleDeleteMission}
          onUpdateMission={handleUpdateMission}  // <- Add this line
        />
      )}

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