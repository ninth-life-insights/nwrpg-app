// src/components/review/DayLookAheadModal.jsx
import { useState } from 'react';
import { useMissionCompletion } from '../../contexts/MissionCompletionContext';
import {
  applyOptimisticCompletion,
  applyServerResolved,
  applyCompletionRollback,
  applyOptimisticUncompletion,
} from '../../utils/applyOptimisticCompletion';
import MissionCard from '../missions/MissionCard';
import AddMissionCard from '../missions/AddMissionCard';
import ErrorMessage from '../ui/ErrorMessage';
import './DayLookAheadModal.css';

const DayLookAheadModal = ({
  date,         // dayjs object
  missions,     // missions pre-filtered to this date (dueDate === dateStr)
  onClose,
  onUpdate,     // called after any mutation so parent can reload
}) => {
  const {
    completeMission: completeMissionOptimistic,
    uncompleteMission: uncompleteMissionOptimistic,
  } = useMissionCompletion();
  const [localMissions, setLocalMissions] = useState(missions);
  const [showAddMission, setShowAddMission] = useState(false);
  const [actionError, setActionError] = useState(null);

  const dateStr = date.format('YYYY-MM-DD');

  const handleToggleComplete = async (missionId, isCompleted) => {
    setActionError(null);

    if (isCompleted) {
      uncompleteMissionOptimistic(missionId, {
        onLocalMutation: (event) => {
          if (event.type === 'uncompleted') {
            setLocalMissions(prev => applyOptimisticUncompletion(prev, missionId));
          } else if (event.type === 'rollback') {
            setLocalMissions(prev => applyOptimisticCompletion(prev, missionId));
          }
        },
        onResolved: () => {
          onUpdate?.();
        },
        onError: () => {
          setActionError("That mission didn't update. Try again.");
        },
      });
      return;
    }

    const mission = localMissions.find(m => m.id === missionId);
    completeMissionOptimistic(missionId, mission, {
      onLocalMutation: (event) => {
        if (event.type === 'completed') {
          setLocalMissions(prev => applyOptimisticCompletion(prev, missionId));
        } else if (event.type === 'serverResolved') {
          setLocalMissions(prev => applyServerResolved(prev, missionId, event.result));
        } else if (event.type === 'rollback') {
          setLocalMissions(prev => applyCompletionRollback(prev, missionId));
        }
      },
      onResolved: () => {
        onUpdate?.();
      },
      onError: () => {
        setActionError("That mission didn't update. Try again.");
      },
    });
  };

  const handleMissionChanged = (missionId, changeType) => {
    if (changeType === 'deleted' || changeType === 'archived') {
      setLocalMissions(prev => prev.filter(m => m.id !== missionId));
    }
    onUpdate?.();
  };

  const handleMissionAdded = (newMission) => {
    if (newMission?.dueDate === dateStr) {
      setLocalMissions(prev => [...prev, newMission]);
    }
    setShowAddMission(false);
    onUpdate?.();
  };

  const activeMissions = localMissions.filter(m => m.status !== 'completed');
  const completedMissions = localMissions.filter(m => m.status === 'completed');

  return (
    <div
      className="wp-modal-overlay"
      onClick={e => { e.stopPropagation(); onClose(); }}
    >
      <div className="wp-modal-sheet wla-sheet" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="wp-modal-header">
          <div className="wp-modal-title-group">
            <h3 className="wp-modal-day">{date.format('dddd')}</h3>
            <p className="wp-modal-date">{date.format('MMM D')} · missions due</p>
          </div>
          <button className="wp-modal-close" onClick={onClose} aria-label="Close">
            <span className="material-icons">close</span>
          </button>
        </div>

        {actionError && (
          <div className="wla-error">
            <ErrorMessage message={actionError} />
          </div>
        )}

        {/* Mission list */}
        <div className="wla-list">
          {activeMissions.length === 0 && completedMissions.length === 0 && (
            <p className="wla-empty">No missions due on this day.</p>
          )}

          {activeMissions.map(m => (
            <MissionCard
              key={m.id}
              mission={m}
              onToggleComplete={handleToggleComplete}
              onMissionChanged={handleMissionChanged}
            />
          ))}

          {completedMissions.length > 0 && (
            <>
              <p className="wla-completed-label">Completed</p>
              {completedMissions.map(m => (
                <MissionCard
                  key={m.id}
                  mission={m}
                      onToggleComplete={handleToggleComplete}
                  onMissionChanged={handleMissionChanged}
                    />
              ))}
            </>
          )}
        </div>

        {/* Add mission form */}
        {showAddMission && (
          <div className="wla-form-section">
            <AddMissionCard
              mode="add"
              initialDueDate={dateStr}
              onAddMission={handleMissionAdded}
              onCancel={() => setShowAddMission(false)}
            />
          </div>
        )}

        {/* Add button */}
        {!showAddMission && (
          <div className="wla-add-row">
            <button
              className="add-mission-btn"
              onClick={() => setShowAddMission(true)}
            >
              + Add Mission
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default DayLookAheadModal;
