// src/components/review/DayLookAheadModal.jsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { completeMissionWithRecurrence } from '../../services/missionService';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import AddMissionCard from '../missions/AddMissionCard';
import ErrorMessage from '../ui/ErrorMessage';
import './DayLookAheadModal.css';

const DayLookAheadModal = ({
  date,         // dayjs object
  missions,     // missions pre-filtered to this date (dueDate === dateStr)
  onClose,
  onUpdate,     // called after any mutation so parent can reload
}) => {
  const { currentUser } = useAuth();
  const [localMissions, setLocalMissions] = useState(missions);
  const [editingMission, setEditingMission] = useState(null);
  const [showAddMission, setShowAddMission] = useState(false);
  const [actionError, setActionError] = useState(null);

  const dateStr = date.format('YYYY-MM-DD');

  const handleToggleComplete = async (missionId, isCompleted) => {
    if (isCompleted) {
      // Uncomplete not supported via this modal — read-only toggle back
      return;
    }
    setActionError(null);
    try {
      await completeMissionWithRecurrence(currentUser.uid, missionId);
      setLocalMissions(prev =>
        prev.map(m => m.id === missionId ? { ...m, status: 'completed' } : m)
      );
      onUpdate?.();
    } catch (err) {
      console.error('Error completing mission:', err);
      setActionError("That mission didn't complete. Try again.");
    }
  };

  const handleViewDetails = (mission) => {
    setEditingMission(mission);
    setShowAddMission(false);
  };

  const handleMissionUpdated = (updated) => {
    setLocalMissions(prev =>
      prev.map(m => m.id === updated.id ? updated : m)
    );
    setEditingMission(null);
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

        {/* Error */}
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
            <MissionCardCondensed
              key={m.id}
              mission={m}
              onToggleComplete={handleToggleComplete}
              onViewDetails={handleViewDetails}
            />
          ))}

          {completedMissions.length > 0 && (
            <>
              <p className="wla-completed-label">Completed</p>
              {completedMissions.map(m => (
                <MissionCardCondensed
                  key={m.id}
                  mission={m}
                  onToggleComplete={handleToggleComplete}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </>
          )}
        </div>

        {/* Edit form (inline, replaces add) */}
        {editingMission && (
          <div className="wla-form-section">
            <p className="wla-form-label">Edit mission</p>
            <AddMissionCard
              mode="edit"
              initialMission={editingMission}
              onUpdateMission={handleMissionUpdated}
              onCancel={() => setEditingMission(null)}
            />
          </div>
        )}

        {/* Add mission form */}
        {showAddMission && !editingMission && (
          <div className="wla-form-section">
            <p className="wla-form-label">New mission</p>
            <AddMissionCard
              mode="add"
              initialDueDate={dateStr}
              onAddMission={handleMissionAdded}
              onCancel={() => setShowAddMission(false)}
            />
          </div>
        )}

        {/* Add button */}
        {!showAddMission && !editingMission && (
          <div className="wla-add-row">
            <button
              className="wla-add-btn"
              onClick={() => setShowAddMission(true)}
            >
              <span className="material-icons">add</span>
              Add a mission for this day
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DayLookAheadModal;
