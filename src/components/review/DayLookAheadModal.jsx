// src/components/review/DayLookAheadModal.jsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  completeMissionWithRecurrence,
  uncompleteMission,
  deleteMission,
  archiveMission,
  updateMission,
} from '../../services/missionService';
import MissionCard from '../missions/MissionCard';
import MissionDetailView from '../missions/MissionCardFull';
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
  const [selectedMission, setSelectedMission] = useState(null);
  const [showAddMission, setShowAddMission] = useState(false);
  const [actionError, setActionError] = useState(null);

  const dateStr = date.format('YYYY-MM-DD');

  const handleToggleComplete = async (missionId, isCompleted) => {
    setActionError(null);
    try {
      if (isCompleted) {
        await uncompleteMission(currentUser.uid, missionId);
        setLocalMissions(prev =>
          prev.map(m => m.id === missionId ? { ...m, status: 'active' } : m)
        );
      } else {
        await completeMissionWithRecurrence(currentUser.uid, missionId);
        setLocalMissions(prev =>
          prev.map(m => m.id === missionId ? { ...m, status: 'completed' } : m)
        );
      }
      onUpdate?.();
    } catch (err) {
      console.error('Error toggling mission:', err);
      setActionError("That mission didn't update. Try again.");
    }
  };

  const handleViewDetails = (mission) => {
    setSelectedMission(mission);
    setShowAddMission(false);
  };

  const handleUpdateMission = async (updatedMission) => {
    setLocalMissions(prev =>
      prev.map(m => m.id === updatedMission.id ? updatedMission : m)
    );
    setSelectedMission(updatedMission);
    onUpdate?.();
  };

  const handleDeleteMission = async (missionId) => {
    try {
      await deleteMission(currentUser.uid, missionId);
      setLocalMissions(prev => prev.filter(m => m.id !== missionId));
      setSelectedMission(null);
      onUpdate?.();
    } catch (err) {
      console.error('Error deleting mission:', err);
      setActionError("That mission didn't delete. Try again.");
    }
  };

  const handleArchiveMission = async (missionId) => {
    try {
      await archiveMission(currentUser.uid, missionId);
      setLocalMissions(prev => prev.filter(m => m.id !== missionId));
      setSelectedMission(null);
      onUpdate?.();
    } catch (err) {
      console.error('Error archiving mission:', err);
      setActionError("That mission didn't archive. Try again.");
    }
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
              onViewDetails={handleViewDetails}
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
                  onViewDetails={handleViewDetails}
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

      {/* MissionCardFull — renders on top, same as rest of app */}
      {selectedMission && (
        <MissionDetailView
          mission={selectedMission}
          onClose={() => setSelectedMission(null)}
          onToggleComplete={handleToggleComplete}
          onDeleteMission={handleDeleteMission}
          onArchiveMission={handleArchiveMission}
          onUpdateMission={handleUpdateMission}
        />
      )}
    </div>
  );
};

export default DayLookAheadModal;
