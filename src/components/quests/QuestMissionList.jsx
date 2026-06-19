// src/components/quests/QuestMissionList.js

import { useAuth } from '../../contexts/AuthContext';
import MissionCard from '../missions/MissionCard';
import { useNotifications } from '../../contexts/NotificationContext';
import { useMissionCompletion } from '../../contexts/MissionCompletionContext';
import { uncompleteMission } from '../../services/missionService';
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
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './QuestMissionList.css';

// Sortable Mission Card Wrapper
const SortableMissionCard = ({
  mission,
  isEditMode,
  onToggleComplete,
  onMissionChanged,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: mission.id,
    disabled: !isEditMode 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { notifyMissionCompletion } = useNotifications();

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`sortable-mission-wrapper ${isDragging ? 'dragging' : ''}`}
    >
      <div className="mission-card-container">
        {isEditMode && (
          <div className="drag-handle" {...attributes} {...listeners}>
            <span className="material-icons">drag_indicator</span>
          </div>
        )}
        
        <div className="mission-card-content">
          <MissionCard
            mission={mission}
            onToggleComplete={onToggleComplete}
            onMissionChanged={onMissionChanged}
          />
        </div>

        {isEditMode && (
          <button 
            className="remove-mission-btn"
            onClick={() => onRemove(mission.id)}
            title="Remove from quest"
          >
            −
          </button>
        )}
      </div>
    </div>
  );
};

const QuestMissionList = ({
  missions,
  questMissionOrder,
  isEditMode,
  onMissionUpdate,
  onRemoveMission,
  onReorderMissions,
  onAchievementsUnlocked,
}) => {
  const { currentUser } = useAuth();
  const { completeMission: completeMissionOptimistic } = useMissionCompletion();
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sort missions based on questMissionOrder, then by completion status
  const sortedMissions = [...missions].sort((a, b) => {
    const aIndex = questMissionOrder.indexOf(a.id);
    const bIndex = questMissionOrder.indexOf(b.id);
    
    // If both have order, sort by order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    
    // If only one has order, prioritize it
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    // Sort by completion status (incomplete first)
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    
    return 0;
  });

  const handleToggleComplete = async (missionId, isCurrentlyCompleted) => {
    if (isCurrentlyCompleted) {
      try {
        await uncompleteMission(currentUser.uid, missionId);
        if (onMissionUpdate) onMissionUpdate();
      } catch (err) {
        console.error('Error uncompleting mission:', err);
      }
      return;
    }

    const mission = missions.find((m) => m.id === missionId);
    completeMissionOptimistic(missionId, mission, {
      // QuestMissionList doesn't own the missions array — its parent
      // (QuestDetailView) does and refreshes via onMissionUpdate. So the
      // optimistic visual flip relies entirely on the card-level context
      // selector. The parent refresh runs after server resolves for
      // eventual consistency.
      onResolved: () => {
        if (onMissionUpdate) onMissionUpdate();
      },
      onAchievementsResolved: (achievements) => {
        if (onAchievementsUnlocked) onAchievementsUnlocked(achievements);
      },
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!isEditMode || !over || active.id === over.id) {
      return;
    }

    const oldIndex = sortedMissions.findIndex((m) => m.id === active.id);
    const newIndex = sortedMissions.findIndex((m) => m.id === over.id);

    const reorderedMissions = arrayMove(sortedMissions, oldIndex, newIndex);
    const newOrder = reorderedMissions.map(m => m.id);
    
    if (onReorderMissions) {
      onReorderMissions(newOrder);
    }
  };

  const handleRemoveMission = (missionId) => {
    if (window.confirm('Remove this mission from the quest? The mission will still exist in your Mission Bank.')) {
      onRemoveMission(missionId);
    }
  };

  if (missions.length === 0) {
    return (
      <div className="quest-missions-empty">
        <p>No missions in this quest yet. Add your first mission to get started!</p>
      </div>
    );
  }

  return (
    <div className="quest-mission-list">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedMissions.map(m => m.id)}
          strategy={verticalListSortingStrategy}
          disabled={!isEditMode}
        >
          {sortedMissions.map((mission) => (
            <SortableMissionCard
              key={mission.id}
              mission={mission}
              isEditMode={isEditMode}
              onToggleComplete={handleToggleComplete}
              onMissionChanged={onMissionUpdate}
              onRemove={handleRemoveMission}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default QuestMissionList;