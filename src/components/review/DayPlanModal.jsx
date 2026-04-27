// src/components/review/DayPlanModal.jsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  planDailyMissionsForDate,
  syncScheduledDatesOnMissions,
} from '../../services/dailyMissionService';
import MissionList from '../missions/MissionList';
import AddMissionCard from '../missions/AddMissionCard';
import ErrorMessage from '../ui/ErrorMessage';
import './DayPlanModal.css';

const DayPlanModal = ({
  date,               // dayjs object
  allMissions,        // full active mission bank
  initialPlannedIds,  // string[] already saved for this date
  onSave,             // (newIds: string[]) => void  — called after successful save
  onClose,
}) => {
  const { currentUser } = useAuth();
  const [selectedIds, setSelectedIds] = useState(initialPlannedIds || []);
  const [showPicker, setShowPicker] = useState(false);
  const [showAddMission, setShowAddMission] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const dateStr = date.format('YYYY-MM-DD');
  const selectedMissions = selectedIds
    .map(id => allMissions.find(m => m.id === id))
    .filter(Boolean);
  const availableMissions = allMissions.filter(m => !selectedIds.includes(m.id));
  const canAdd = selectedIds.length < 3;
  const canSave = selectedIds.length >= 1;

  const handleRemove = (id) => {
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  const handleSelect = (mission) => {
    if (selectedIds.includes(mission.id) || selectedIds.length >= 3) return;
    setSelectedIds(prev => [...prev, mission.id]);
    setShowPicker(false);
  };

  const handleAddNew = (newMission) => {
    if (!newMission?.id || selectedIds.length >= 3) return;
    setSelectedIds(prev => [...prev, newMission.id]);
    setShowAddMission(false);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all([
        planDailyMissionsForDate(currentUser.uid, selectedIds, dateStr),
        syncScheduledDatesOnMissions(currentUser.uid, initialPlannedIds || [], selectedIds, dateStr),
      ]);
      onSave(selectedIds);
      onClose();
    } catch (err) {
      console.error('Error saving day plan:', err);
      setSaveError("That day's plan didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="wp-modal-overlay"
      onClick={e => { e.stopPropagation(); onClose(); }}
    >
      <div className="wp-modal-sheet" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="wp-modal-header">
          <div className="wp-modal-title-group">
            <h3 className="wp-modal-day">{date.format('dddd')}</h3>
            <p className="wp-modal-date">{date.format('MMM D')}</p>
          </div>
          <button className="wp-modal-close" onClick={onClose} aria-label="Close">
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Subheading */}
        <p className="wp-modal-subtext">
          Pick up to 3 priority missions for this day.
        </p>

        {/* Selected missions */}
        <div className="wp-modal-selected">
          {selectedMissions.length === 0 && (
            <p className="wp-modal-empty">No priorities set yet.</p>
          )}
          {selectedMissions.map(m => (
            <div key={m.id} className="wp-modal-mission-row">
              <span className="wp-modal-mission-title">{m.title}</span>
              <button
                className="wp-modal-remove-btn"
                onClick={() => handleRemove(m.id)}
                aria-label={`Remove ${m.title}`}
              >
                <span className="material-icons">close</span>
              </button>
            </div>
          ))}
        </div>

        {/* Slot indicator */}
        <div className="wp-modal-slots">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`wp-modal-slot ${i < selectedIds.length ? 'wp-modal-slot--filled' : ''}`}
            />
          ))}
          <span className="wp-modal-slots-label">
            {selectedIds.length}/3 selected
          </span>
        </div>

        {/* Add controls */}
        {canAdd && !showPicker && !showAddMission && (
          <div className="wp-modal-add-controls">
            <button
              className="wp-modal-add-btn"
              onClick={() => setShowPicker(true)}
            >
              <span className="material-icons">list</span>
              Choose from mission bank
            </button>
            <button
              className="wp-modal-add-btn wp-modal-add-btn--secondary"
              onClick={() => setShowAddMission(true)}
            >
              <span className="material-icons">add</span>
              Create new mission
            </button>
          </div>
        )}

        {/* Mission bank picker */}
        {showPicker && (
          <div className="wp-modal-picker">
            <div className="wp-modal-picker-header">
              <span className="wp-modal-picker-title">Mission bank</span>
              <button
                className="wp-modal-picker-close"
                onClick={() => setShowPicker(false)}
              >
                <span className="material-icons">close</span>
              </button>
            </div>
            <MissionList
              missions={availableMissions}
              selectionMode
              onMissionSelect={handleSelect}
              selectedMissions={[]}
              showFilters={false}
              showAddMission={false}
            />
          </div>
        )}

        {/* New mission form */}
        {showAddMission && (
          <div className="wp-modal-add-form">
            <AddMissionCard
              mode="add"
              initialDueDate={dateStr}
              onAddMission={handleAddNew}
              onCancel={() => setShowAddMission(false)}
            />
          </div>
        )}

        {/* Footer */}
        <div className="wp-modal-footer">
          {saveError && <ErrorMessage message={saveError} />}
          <button
            className="wp-modal-save-btn"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? 'Saving...' : `Save priorities for ${date.format('ddd, MMM D')}`}
          </button>
          {!canSave && (
            <p className="wp-modal-save-hint">Add at least one mission to save.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayPlanModal;
