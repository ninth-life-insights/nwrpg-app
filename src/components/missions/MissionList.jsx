// src/components/missions/MissionList.js - WITH DRAG AND DROP
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import MissionCard from './MissionCard';
import AddMissionCard from './AddMissionCard';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  getActiveMissions,
  getCompletedMissions,
  getExpiredMissions,
  uncompleteMission,
  completeMissionWithRecurrence,
  updateMissionCustomOrder,
  batchUpdateMissionOrders
} from '../../services/missionService';

import { 
  addDailyMissionStatus 
} from '../../services/dailyMissionService';

import {
  applyMissionFiltersAndSort,
  getMissionListDisplayMissions,
  groupMissionsByDueDate,
  normalizeMissionListFilters
} from '../../utils/missionListFilters';
import { useRooms } from '../../contexts/RoomsContext';
import { useQuests } from '../../contexts/QuestsContext';
import './MissionList.css';

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
  searchQuery = '',
  onApplyFilters = null,
  onResetFilters = null,
  selectionMode = false,
  onMissionSelect = null,
  selectedMissions = [],
  maxSelections = null,
  recentlyCompletedMissions = [],
  onMissionCompletion = null,
  onMissionUncompletion = null,
  onRecurringMissionCreated = null,
  onAchievementsUnlocked = null
}) => {
  const { currentUser } = useAuth();
  const { roomsMap } = useRooms();
  const { questsMap } = useQuests();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDragPrompt, setShowDragPrompt] = useState(false);
  const [dragPromptPosition, setDragPromptPosition] = useState(null);
  const [hasInitializedCustomOrder, setHasInitializedCustomOrder] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

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

  const memoizedFilters = useMemo(() => normalizeMissionListFilters(filters), [
    filters.sortBy, filters.sortOrder, filters.skillFilter,
    filters.includeCompleted, filters.showArchive, filters.completedDateRange,
    filters.roomFilter, filters.taskTypeFilter, filters.questFilter,
    filters.priorityFilter
  ]);

  const isCustomOrderMode = memoizedFilters.sortBy === 'custom';

  const { notifyMissionCompletion } = useNotifications();

  useEffect(() => {
    if (currentUser) {
      loadMissions();
    }
  }, [currentUser, missionType, memoizedFilters]);

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
      } else if (missionType === 'active_completed') {
        const [activeData, completedData] = await Promise.all([
          getActiveMissions(currentUser.uid),
          getCompletedMissions(currentUser.uid)
        ]);
        missionData = [...activeData, ...completedData];
      } else if (missionType === 'expired') {
        try {
          missionData = await getExpiredMissions(currentUser.uid);
        } catch (err) {
          console.warn('getExpiredMissions not available:', err);
          missionData = [];
        }
      }
      
      const missionsWithDailyStatus = await addDailyMissionStatus(currentUser.uid, missionData);
      const processedMissions = applyMissionFiltersAndSort(missionsWithDailyStatus, memoizedFilters);
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

        notifyMissionCompletion(result);

        if (result.nextMissionCreated && onRecurringMissionCreated) {
          onRecurringMissionCreated({
            originalMissionId: missionId,
            nextMissionId: result.nextMissionId,
            nextDueDate: result.nextDueDate,
            missionTitle: completedMission.title
          });
        }

        if (completedMission && onMissionCompletion) {
          const updatedMission = { ...completedMission, status: 'completed', xpAwarded: result.xpAwarded, completedAt: new Date() };
          onMissionCompletion(updatedMission);
        }

        if (result?.newlyAwardedAchievements?.length > 0 && onAchievementsUnlocked) {
          onAchievementsUnlocked(result.newlyAwardedAchievements);
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

  // Lightweight in-place update for a single mission's priority flag.
  // Avoids the full Firestore reload that onMissionChanged would trigger,
  // which would re-mount the open MissionCardFull and close it.
  const handlePriorityToggled = (missionId, isPriority) => {
    setMissions(prev => prev.map(m =>
      m.id === missionId ? { ...m, isPriority } : m
    ));
  };

  const handleAddMission = (newMission) => {
    if (!newMission.id) {
      console.error('BLOCKING: Cannot add mission without ID');
      console.error('Mission object:', newMission);
      return;
    }

    setMissions(prev => [newMission, ...prev]);
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

  const displayMissions = getMissionListDisplayMissions({
    missions,
    missionType,
    recentlyCompletedMissions,
    searchQuery,
    roomsMap,
    questsMap
  });

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
    const isArchiveView = missionType === 'expired';
    const hasActiveFilters = !isArchiveView && (
      searchQuery ||
      memoizedFilters.skillFilter ||
      memoizedFilters.roomFilter ||
      memoizedFilters.taskTypeFilter ||
      memoizedFilters.questFilter ||
      memoizedFilters.includeCompleted
    );

    const emptyMessage = isArchiveView
      ? "No archived missions."
      : hasActiveFilters
        ? "No missions match your current filters."
        : missionType === 'active'
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
          {hasActiveFilters && onResetFilters && (
            <div style={{ marginTop: '12px' }}>
              <button
                onClick={onResetFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#007bff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: 0
                }}
              >
                Reset filters
              </button>
            </div>
          )}
          {isArchiveView && onApplyFilters && (
            <div style={{ marginTop: '12px' }}>
              <button
                onClick={() => onApplyFilters({ ...filters, showArchive: false })}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#007bff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: 0
                }}
              >
                ← Back to active missions
              </button>
            </div>
          )}
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

  // Grouped view kicks in only when the user has explicitly chosen to sort by
  // due date — that's the context where "Overdue / Today / This Week / Later"
  // bucketing helps. Other sorts stay flat. Selection mode is always flat.
  // When includeCompleted is on, completed missions render in their own
  // "Done" group above the date buckets so they don't muddle the timeline.
  const isDueDateGrouped = memoizedFilters.sortBy === 'dueDate' && !selectionMode;
  const completedInGroupedView = isDueDateGrouped
    ? displayMissions.filter(m => m.status === 'completed')
    : [];
  const activeForBuckets = isDueDateGrouped
    ? displayMissions.filter(m => m.status !== 'completed')
    : [];
  const dueDateGroups = isDueDateGrouped ? groupMissionsByDueDate(activeForBuckets) : [];

  const toggleGroup = (key) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderMissionItem = (mission, index, options = {}) => {
    const { applyRecentMargin = true } = options;
    const isSelected = selectionMode && selectedMissions.some(selected => selected.id === mission.id);
    const isRecentlyCompleted = recentlyCompletedMissions.some(completed => completed.id === mission.id);

    return (
      <div
        key={mission.id}
        className={`mission-wrapper ${selectionMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''} ${isRecentlyCompleted ? 'recently-completed' : ''}`}
        onClick={() => {
          if (!selectionMode) return;
          handleMissionSelect(mission);
        }}
        onKeyDown={(e) => {
          if (!selectionMode) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleMissionSelect(mission);
          }
        }}
        role={selectionMode ? 'button' : undefined}
        tabIndex={selectionMode ? 0 : undefined}
        style={{
          position: 'relative',
          ...(selectionMode && {
            cursor: 'pointer',
            padding: '0.5px 4px',
            margin: '0 4px',
            maxWidth: '400px',
            borderRadius: '12px',
            border: isSelected ? '3px solid #2196f3' : '',
            backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
            transition: 'all 0.2s ease'
          }),
          ...(applyRecentMargin && isRecentlyCompleted && {
            marginBottom: index === recentlyCompletedMissions.length - 1 ? '25px' : '8px'
          })
        }}
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
          mission={mission}
          onToggleComplete={handleToggleComplete}
          onMissionChanged={loadMissions}
          onPriorityToggled={handlePriorityToggled}
          onSelect={selectionMode ? handleMissionSelect : undefined}
          selectionMode={selectionMode}
          isRecentlyCompleted={isRecentlyCompleted}
          isCustomOrderMode={isCustomOrderMode}
        />
      </div>
    );
  };

  return (
    <div className={selectionMode ? 'mission-list-selection-mode' : 'mission-list'}>

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
          {isDueDateGrouped ? (
            <div className="mission-due-groups">
              {completedInGroupedView.length > 0 && (() => {
                const isCollapsed = collapsedGroups.has('done');
                return (
                  <section className="mission-due-group mission-due-group--done">
                    <button
                      type="button"
                      className="mission-due-group-header"
                      onClick={() => toggleGroup('done')}
                      aria-expanded={!isCollapsed}
                    >
                      <span className="material-icons-outlined mission-due-group-chevron">
                        {isCollapsed ? 'chevron_right' : 'expand_more'}
                      </span>
                      <span className="mission-due-group-label">Done</span>
                      <span className="mission-due-group-count">{completedInGroupedView.length}</span>
                    </button>
                    {!isCollapsed && completedInGroupedView.map((mission, i) => renderMissionItem(mission, i, { applyRecentMargin: false }))}
                  </section>
                );
              })()}
              {dueDateGroups.map(group => {
                const isCollapsed = collapsedGroups.has(group.key);
                return (
                  <section key={group.key} className={`mission-due-group mission-due-group--${group.key}`}>
                    <button
                      type="button"
                      className="mission-due-group-header"
                      onClick={() => toggleGroup(group.key)}
                      aria-expanded={!isCollapsed}
                    >
                      <span className="material-icons-outlined mission-due-group-chevron">
                        {isCollapsed ? 'chevron_right' : 'expand_more'}
                      </span>
                      <span className="mission-due-group-label">{group.label}</span>
                      <span className="mission-due-group-count">{group.missions.length}</span>
                    </button>
                    {!isCollapsed && group.missions.map((mission, i) => renderMissionItem(mission, i, { applyRecentMargin: false }))}
                  </section>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              {displayMissions.map((mission, i) => renderMissionItem(mission, i))}
            </div>
          )}
        </SortableContext>
      </DndContext>

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
