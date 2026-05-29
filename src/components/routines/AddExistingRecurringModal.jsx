// src/components/routines/AddExistingRecurringModal.jsx
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRoutines } from '../../contexts/RoutineContext';
import { batchAddMissionsToRoutine } from '../../services/routineService';
import {
  getMissionChainRoot,
  isMissionInRoutineSet,
} from '../../utils/routineHelpers';
import { isRecurringMission } from '../../utils/recurrenceHelpers';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import ErrorMessage from '../ui/ErrorMessage';
import './AddExistingRecurringModal.css';

// Multi-select picker for adding recurring missions to a routine.
// Eligibility: active recurring missions whose chain root is NOT currently in
// any routine. We dedupe by chain root in case (defensively) there are two
// active rows for the same chain; selection is keyed on the root.
const AddExistingRecurringModal = ({
  routineId,
  missions,
  routineRootSet,
  roomFilter = '',
  onClose,
  onSaved,
}) => {
  const { currentUser } = useAuth();
  const { refreshRoutines } = useRoutines();
  const [selectedRootIds, setSelectedRootIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useModalBackButton(true, onClose);

  // Build a map of chain root → mission instance (the active instance we'll
  // show in the list). Filter out non-recurring missions, any whose root is
  // already in some routine, and (when a room filter is active on the page)
  // any whose baseLocation doesn't match. The room filter narrows the picker
  // so users browsing "Kitchen routines" only see Kitchen-eligible options.
  const eligibleMissions = useMemo(() => {
    const byRoot = new Map();
    for (const m of missions || []) {
      if (!isRecurringMission(m)) continue;
      if (isMissionInRoutineSet(m, routineRootSet)) continue;
      if (roomFilter && m.baseLocation !== roomFilter) continue;
      const root = getMissionChainRoot(m);
      if (!root) continue;
      if (!byRoot.has(root)) byRoot.set(root, m);
    }
    return Array.from(byRoot.values());
  }, [missions, routineRootSet, roomFilter]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const toggleSelect = (rootId) => {
    setSelectedRootIds((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  };

  const allSelected =
    eligibleMissions.length > 0 &&
    selectedRootIds.size === eligibleMissions.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedRootIds(new Set());
    } else {
      setSelectedRootIds(
        new Set(eligibleMissions.map((m) => getMissionChainRoot(m)))
      );
    }
  };

  const handleSave = async () => {
    if (saving || selectedRootIds.size === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await batchAddMissionsToRoutine(
        currentUser.uid,
        routineId,
        Array.from(selectedRootIds)
      );
      await refreshRoutines();
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Add existing to routine failed:', err);
      setSaveError(err?.message || "Those didn't add to your routine. Try again.");
      setSaving(false);
    }
  };

  const content = (
    <div className="add-existing-routine-overlay" onClick={handleBackdropClick}>
      <div className="add-existing-routine-modal" role="dialog" aria-modal="true">
        <div className="add-existing-routine-header">
          <h2 className="add-existing-routine-title">Add existing recurring</h2>
          <button
            className="add-existing-routine-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="add-existing-routine-body">
          {eligibleMissions.length === 0 ? (
            <div className="add-existing-routine-empty">
              No recurring missions outside your routine right now.
              <div className="add-existing-routine-empty-sub">
                Create new ones with "Add new tasks."
              </div>
            </div>
          ) : (
            <>
              <button
                className="add-existing-select-all"
                onClick={toggleSelectAll}
              >
                <span
                  className={`add-existing-checkbox ${
                    allSelected ? 'is-checked' : ''
                  }`}
                >
                  {allSelected && <span className="material-icons">check</span>}
                </span>
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>

              {saveError && <ErrorMessage message={saveError} />}

              <div className="add-existing-list">
                {eligibleMissions.map((mission) => {
                  const root = getMissionChainRoot(mission);
                  const isSelected = selectedRootIds.has(root);
                  return (
                    <div
                      key={root}
                      className={`add-existing-row ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => toggleSelect(root)}
                    >
                      <button
                        type="button"
                        className="add-existing-checkbox-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(root);
                        }}
                        aria-label={isSelected ? 'Deselect' : 'Select'}
                      >
                        <span
                          className={`add-existing-checkbox ${isSelected ? 'is-checked' : ''}`}
                        >
                          {isSelected && (
                            <span className="material-icons">check</span>
                          )}
                        </span>
                      </button>
                      <div
                        className="add-existing-card-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MissionCardCondensed mission={mission} readOnly={true} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="add-existing-routine-footer">
          <button
            type="button"
            className="add-existing-cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="add-existing-save"
            onClick={handleSave}
            disabled={saving || selectedRootIds.size === 0}
          >
            {saving
              ? 'Adding…'
              : selectedRootIds.size === 0
              ? 'Add to routine'
              : `Add ${selectedRootIds.size} to routine`}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default AddExistingRecurringModal;
