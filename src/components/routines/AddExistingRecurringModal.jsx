// src/components/routines/AddExistingRecurringModal.jsx
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRooms } from '../../contexts/RoomsContext';
import { useRoutines } from '../../contexts/RoutineContext';
import { ENTIRE_BASE_ROOM_ID } from '../../services/roomService';
import { batchAddMissionsToRoutine } from '../../services/routineService';
import {
  getMissionChainRoot,
  isMissionInRoutineSet,
} from '../../utils/routineHelpers';
import { isRecurringMission } from '../../utils/recurrenceHelpers';
import { NO_ROOM_FILTER } from './RoutineBuilderSection';
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
  skillFilter = '',
  onClose,
  onSaved,
}) => {
  const { currentUser } = useAuth();
  const { rooms } = useRooms();
  const { refreshRoutines } = useRoutines();
  const [selectedRootIds, setSelectedRootIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useModalBackButton(true, onClose);

  // Human-readable filter indicator. Only shown when at least one filter is
  // active — helps users understand why the list isn't showing every recurring
  // task. Combines room + skill filters with a middle dot.
  const filterLabel = useMemo(() => {
    const parts = [];
    if (roomFilter === NO_ROOM_FILTER) {
      parts.push('personal');
    } else if (roomFilter) {
      const room = rooms.find((r) => r.id === roomFilter);
      if (room) {
        parts.push(room.id === ENTIRE_BASE_ROOM_ID ? 'Entire Base' : room.name);
      }
    }
    if (skillFilter) parts.push(skillFilter);
    return parts.length === 0 ? null : parts.join(' · ');
  }, [roomFilter, skillFilter, rooms]);

  // Build a map of chain root → mission instance (the active instance we'll
  // show in the list). Filter out non-recurring missions, any whose root is
  // already in some routine, and (when filters are active on the page) any
  // that don't match. The page filters narrow the picker so users browsing
  // "Kitchen routines" only see Kitchen-eligible options.
  const eligibleMissions = useMemo(() => {
    const byRoot = new Map();
    for (const m of missions || []) {
      if (!isRecurringMission(m)) continue;
      if (isMissionInRoutineSet(m, routineRootSet)) continue;
      if (roomFilter === NO_ROOM_FILTER) {
        if (m.baseLocation) continue;
      } else if (roomFilter && m.baseLocation !== roomFilter) {
        continue;
      }
      if (skillFilter && m.skill !== skillFilter) continue;
      const root = getMissionChainRoot(m);
      if (!root) continue;
      if (!byRoot.has(root)) byRoot.set(root, m);
    }
    return Array.from(byRoot.values());
  }, [missions, routineRootSet, roomFilter, skillFilter]);

  // Apply free-text search on top of the eligibility filter. Search is local
  // to the modal session — closing the modal resets it.
  const displayedMissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligibleMissions;
    return eligibleMissions.filter((m) =>
      (m.title || '').toLowerCase().includes(q)
    );
  }, [eligibleMissions, searchQuery]);

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

  const allDisplayedSelected =
    displayedMissions.length > 0 &&
    displayedMissions.every((m) => selectedRootIds.has(getMissionChainRoot(m)));

  const toggleSelectAllDisplayed = () => {
    const displayedRoots = displayedMissions.map((m) => getMissionChainRoot(m));
    if (allDisplayedSelected) {
      setSelectedRootIds((prev) => {
        const next = new Set(prev);
        for (const r of displayedRoots) next.delete(r);
        return next;
      });
    } else {
      setSelectedRootIds((prev) => {
        const next = new Set(prev);
        for (const r of displayedRoots) next.add(r);
        return next;
      });
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

  // Empty-state messaging differentiates the cause:
  //  - eligibleMissions empty: no candidates exist outside the routine
  //  - displayedMissions empty (but eligible non-empty): search has no hits
  const showSearchEmpty =
    eligibleMissions.length > 0 && displayedMissions.length === 0;
  const showNoEligible = eligibleMissions.length === 0;

  const content = (
    <div className="add-existing-routine-overlay" onClick={handleBackdropClick}>
      <div className="add-existing-routine-modal" role="dialog" aria-modal="true">
        <div className="add-existing-routine-header">
          <div className="add-existing-routine-heading">
            <h2 className="add-existing-routine-title">Add existing tasks</h2>
            {filterLabel && (
              <p className="add-existing-routine-subtitle">
                Filtered by {filterLabel}
              </p>
            )}
          </div>
          <button
            className="add-existing-routine-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="add-existing-routine-body">
          {!showNoEligible && (
            <div className="add-existing-search">
              <span className="material-icons add-existing-search-icon">search</span>
              <input
                type="text"
                className="add-existing-search-input"
                placeholder="Search tasks…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="add-existing-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <span className="material-icons">close</span>
                </button>
              )}
            </div>
          )}

          {showNoEligible && (
            <div className="add-existing-routine-empty">
              Nothing else to pull in right now.
              <div className="add-existing-routine-empty-sub">
                Add new tasks from any bucket on the routine page.
              </div>
            </div>
          )}

          {showSearchEmpty && (
            <div className="add-existing-routine-empty">
              No matches for "{searchQuery.trim()}".
            </div>
          )}

          {!showNoEligible && !showSearchEmpty && (
            <>
              <button
                className="add-existing-select-all"
                onClick={toggleSelectAllDisplayed}
              >
                <span
                  className={`add-existing-checkbox ${
                    allDisplayedSelected ? 'is-checked' : ''
                  }`}
                >
                  {allDisplayedSelected && (
                    <span className="material-icons">check</span>
                  )}
                </span>
                {allDisplayedSelected ? 'Deselect all' : 'Select all'}
              </button>

              {saveError && <ErrorMessage message={saveError} />}

              <div className="add-existing-list">
                {displayedMissions.map((mission) => {
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
