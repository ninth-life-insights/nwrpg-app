// src/components/review/QuestGroomingStep.jsx
import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveQuests, archiveQuest, completeQuest } from '../../services/questService';
import { getActiveMissions, completeMissionWithRecurrence, batchUpdateMissionOrders } from '../../services/missionService';
import StickyFooter from '../ui/StickyFooter';
import ErrorMessage from '../ui/ErrorMessage';
import { withTimeout, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
import './QuestGroomingStep.css';

// ─── Sortable mission row ─────────────────────────────────────────────────────

const SortableMissionRow = ({ mission, onComplete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mission.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isCompleted = mission.status === 'completed';

  return (
    <div ref={setNodeRef} style={style} className={`qg-mission-row ${isCompleted ? 'qg-mission-row--done' : ''}`}>
      <button
        className="qg-drag-handle"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <span className="material-icons">drag_indicator</span>
      </button>
      <button
        className={`qg-complete-btn ${isCompleted ? 'qg-complete-btn--done' : ''}`}
        onClick={() => !isCompleted && onComplete(mission.id)}
        disabled={isCompleted}
        aria-label={isCompleted ? 'Completed' : 'Mark complete'}
      >
        <span className="material-icons">{isCompleted ? 'check_circle' : 'radio_button_unchecked'}</span>
      </button>
      <span className={`qg-mission-title ${isCompleted ? 'qg-mission-title--done' : ''}`}>
        {mission.title}
      </span>
    </div>
  );
};

// ─── Quest accordion panel ────────────────────────────────────────────────────

const QuestPanel = ({
  quest,
  missions,
  onMissionComplete,
  onQuestAction,
  actionError,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(null); // 'archive' | 'complete' | null
  const [localMissions, setLocalMissions] = useState(missions);
  const { currentUser } = useAuth();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const completedCount = localMissions.filter(m => m.status === 'completed').length;
  const progressPct = localMissions.length > 0
    ? Math.round((completedCount / localMissions.length) * 100)
    : 0;

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localMissions.findIndex(m => m.id === active.id);
    const newIndex = localMissions.findIndex(m => m.id === over.id);
    const reordered = arrayMove(localMissions, oldIndex, newIndex);
    setLocalMissions(reordered);

    try {
      const updates = reordered.map((m, i) => ({ missionId: m.id, customSortOrder: i }));
      await batchUpdateMissionOrders(currentUser.uid, updates);
    } catch (err) {
      console.error('Error reordering missions:', err);
      setLocalMissions(missions); // revert on failure
    }
  };

  const handleMissionComplete = async (missionId) => {
    const result = await onMissionComplete(missionId);
    if (result) {
      setLocalMissions(prev =>
        prev.map(m => m.id === missionId ? { ...m, status: 'completed' } : m)
      );
    }
  };

  const handleConfirm = async (action) => {
    setShowConfirm(null);
    await onQuestAction(quest.id, action);
  };

  return (
    <div className={`qg-quest-panel ${expanded ? 'qg-quest-panel--open' : ''}`}>
      <button
        className="qg-quest-header"
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
      >
        <div className="qg-quest-progress-bar">
          <div className="qg-quest-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="qg-quest-title">{quest.title}</span>
        <span className="qg-quest-count">{completedCount}/{localMissions.length}</span>
        <span className="material-icons qg-chevron">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {expanded && (
        <div className="qg-quest-body">
          {localMissions.length === 0 ? (
            <p className="qg-empty">No missions in this quest.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localMissions.map(m => m.id)}
                strategy={verticalListSortingStrategy}
              >
                {localMissions.map(m => (
                  <SortableMissionRow
                    key={m.id}
                    mission={m}
                    onComplete={handleMissionComplete}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {actionError && <ErrorMessage message={actionError} />}

          {showConfirm ? (
            <div className="qg-confirm-row">
              <span className="qg-confirm-text">
                {showConfirm === 'complete'
                  ? 'Mark this quest as complete?'
                  : 'Archive this quest?'}
              </span>
              <div className="qg-confirm-actions">
                <button className="qg-confirm-btn qg-confirm-btn--yes" onClick={() => handleConfirm(showConfirm)}>
                  Yes
                </button>
                <button className="qg-confirm-btn qg-confirm-btn--no" onClick={() => setShowConfirm(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="qg-quest-actions">
              <button className="qg-action-link" onClick={() => setShowConfirm('complete')}>
                Mark quest complete
              </button>
              <button className="qg-action-link qg-action-link--archive" onClick={() => setShowConfirm('archive')}>
                Archive quest
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main step ────────────────────────────────────────────────────────────────

const QuestGroomingStep = ({
  onMissionComplete,
  onNext,
  onSkipToSummary,
}) => {
  const { currentUser } = useAuth();
  const [quests, setQuests] = useState([]);
  const [missionsByQuest, setMissionsByQuest] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [questActionError, setQuestActionError] = useState({});

  const loadData = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const [activeQuests, allMissions] = await withTimeout(
        Promise.all([
          getActiveQuests(currentUser.uid),
          getActiveMissions(currentUser.uid),
        ])
      );

      // Group missions by questId
      const byQuest = {};
      activeQuests.forEach(q => { byQuest[q.id] = []; });
      allMissions.forEach(m => {
        if (m.questId && byQuest[m.questId]) {
          byQuest[m.questId].push(m);
        }
      });

      // Sort each quest's missions by customSortOrder
      Object.keys(byQuest).forEach(qId => {
        byQuest[qId].sort((a, b) => (a.customSortOrder ?? 0) - (b.customSortOrder ?? 0));
      });

      setQuests(activeQuests);
      setMissionsByQuest(byQuest);
    } catch (err) {
      console.error('Error loading quest grooming data:', err);
      setLoadError(getLoadErrorMessage(err, 'quests'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const handleMissionComplete = async (missionId) => {
    try {
      const result = await completeMissionWithRecurrence(currentUser.uid, missionId);
      onMissionComplete?.(result);
      return result;
    } catch (err) {
      console.error('Error completing mission:', err);
      return null;
    }
  };

  const handleQuestAction = async (questId, action) => {
    setQuestActionError(prev => ({ ...prev, [questId]: null }));
    try {
      if (action === 'complete') {
        await completeQuest(currentUser.uid, questId);
      } else if (action === 'archive') {
        await archiveQuest(currentUser.uid, questId);
      }
      setQuests(prev => prev.filter(q => q.id !== questId));
    } catch (err) {
      console.error(`Error ${action}ing quest:`, err);
      setQuestActionError(prev => ({
        ...prev,
        [questId]: `That quest didn't ${action}. Try again.`,
      }));
    }
  };

  return (
    <div className="review-step">
      <div className="review-step-body">
        <h2 className="review-step-heading">Quest Check-In</h2>
        <p className="review-step-subtext">
          Review your active quests. Complete missions, reorder, or close out quests that are done.
        </p>

        {loadError && (
          <ErrorMessage
            message={loadError}
            onRetry={loadData}
          />
        )}

        {loading && !loadError && (
          <p className="review-step-loading">Loading your quests...</p>
        )}

        {!loading && !loadError && quests.length === 0 && (
          <p className="review-step-empty">No active quests. Head to the next step.</p>
        )}

        {!loading && !loadError && quests.map(quest => (
          <QuestPanel
            key={quest.id}
            quest={quest}
            missions={missionsByQuest[quest.id] || []}
            onMissionComplete={handleMissionComplete}
            onQuestAction={handleQuestAction}
            actionError={questActionError[quest.id]}
          />
        ))}
      </div>

      <StickyFooter>
        <button className="review-next-btn" onClick={onNext}>
          Next →
        </button>
        <button className="review-skip-link" onClick={onSkipToSummary}>
          Skip to summary
        </button>
      </StickyFooter>
    </div>
  );
};

export default QuestGroomingStep;
