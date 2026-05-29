// src/components/routines/RoutineBuilderSection.jsx
import { useMemo, useState } from 'react';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import QuickAddRoutineSheet from './QuickAddRoutineSheet';
import AddExistingRecurringModal from './AddExistingRecurringModal';
import ErrorMessage from '../ui/ErrorMessage';
import { useAuth } from '../../contexts/AuthContext';
import { useRooms } from '../../contexts/RoomsContext';
import { useRoutines } from '../../contexts/RoutineContext';
import { removeMissionFromRoutine } from '../../services/routineService';
import { ENTIRE_BASE_ROOM_ID } from '../../services/roomService';
import {
  isMissionInRoutineSet,
  groupRoutineMissionsByFrequency,
  getMissionChainRoot,
} from '../../utils/routineHelpers';
import { RECURRENCE_PATTERNS } from '../../utils/recurrenceHelpers';
import './RoutineBuilderSection.css';

const BUCKETS = [
  { key: 'daily',   frequency: RECURRENCE_PATTERNS.DAILY,   label: 'Daily',   cta: 'Add to Daily' },
  { key: 'weekly',  frequency: RECURRENCE_PATTERNS.WEEKLY,  label: 'Weekly',  cta: 'Add to Weekly' },
  { key: 'monthly', frequency: RECURRENCE_PATTERNS.MONTHLY, label: 'Monthly', cta: 'Add to Monthly' },
  { key: 'yearly',  frequency: RECURRENCE_PATTERNS.YEARLY,  label: 'Yearly',  cta: 'Add to Yearly' },
];

// The Builder is a noticing surface, not a planning form. Each frequency
// bucket is always visible (even empty) — the layout teaches the cadence model.
// Adds happen contextually from each bucket via QuickAddRoutineSheet, which
// inherits the active room filter so common scenarios ("I'm noticing Kitchen
// weekly stuff") become low-friction.
const RoutineBuilderSection = ({
  missions,
  routineRootSet,
  routineId,
  onSaved,
}) => {
  const { currentUser } = useAuth();
  const { rooms } = useRooms();
  const { refreshRoutines } = useRoutines();

  const [roomFilter, setRoomFilter] = useState('');
  const [addBucketFrequency, setAddBucketFrequency] = useState(null);
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [removingRootIds, setRemovingRootIds] = useState(new Set());

  const grouped = useMemo(() => {
    const routineMissions = (missions || []).filter((m) => {
      if (!isMissionInRoutineSet(m, routineRootSet)) return false;
      if (roomFilter && m.baseLocation !== roomFilter) return false;
      return true;
    });
    return groupRoutineMissionsByFrequency(routineMissions);
  }, [missions, routineRootSet, roomFilter]);

  const handleRemove = async (mission) => {
    const root = getMissionChainRoot(mission);
    if (!root) return;
    setActionError(null);
    setRemovingRootIds((prev) => new Set(prev).add(root));
    try {
      await removeMissionFromRoutine(currentUser.uid, routineId, root);
      await refreshRoutines();
      onSaved?.();
    } catch (err) {
      console.error('Remove from routine failed:', err);
      setActionError("That mission didn't leave the routine. Try again.");
    } finally {
      setRemovingRootIds((prev) => {
        const next = new Set(prev);
        next.delete(root);
        return next;
      });
    }
  };

  return (
    <section className="routine-builder">
      <p className="routine-builder-intro">
        Routines are the rhythms that keep things running. Add what should be automatic.
      </p>

      {rooms.length > 0 && (
        <label className="routine-builder-filter">
          <span className="routine-builder-filter-label">Room</span>
          <select
            className="routine-builder-filter-select"
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
          >
            <option value="">All rooms</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.id === ENTIRE_BASE_ROOM_ID ? 'Entire Base' : room.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="routine-builder-top-actions">
        <button
          type="button"
          className="routine-builder-cta"
          onClick={() => setShowAddExisting(true)}
        >
          <span className="material-icons">playlist_add</span>
          Add existing recurring
        </button>
      </div>

      {actionError && <ErrorMessage message={actionError} />}

      {BUCKETS.map((bucket) => (
        <FrequencyGroup
          key={bucket.key}
          label={bucket.label}
          ctaLabel={bucket.cta}
          missions={grouped[bucket.key]}
          onAdd={() => setAddBucketFrequency(bucket.frequency)}
          onRemove={handleRemove}
          removingRootIds={removingRootIds}
        />
      ))}

      {addBucketFrequency && (
        <QuickAddRoutineSheet
          frequency={addBucketFrequency}
          routineId={routineId}
          defaultRoomId={roomFilter}
          onClose={() => setAddBucketFrequency(null)}
          onAdded={onSaved}
        />
      )}
      {showAddExisting && (
        <AddExistingRecurringModal
          routineId={routineId}
          missions={missions}
          routineRootSet={routineRootSet}
          roomFilter={roomFilter}
          onClose={() => setShowAddExisting(false)}
          onSaved={onSaved}
        />
      )}
    </section>
  );
};

const FrequencyGroup = ({ label, ctaLabel, missions, onAdd, onRemove, removingRootIds }) => {
  const list = missions || [];
  return (
    <div className="routine-builder-group">
      <h3 className="routine-builder-group-label">
        {label}
        <span className="routine-builder-group-count">{list.length}</span>
      </h3>
      {list.length > 0 && (
        <div className="routine-builder-group-list">
          {list.map((mission) => {
            const root = getMissionChainRoot(mission);
            const isRemoving = removingRootIds.has(root);
            return (
              <MissionCardCondensed
                key={mission.id}
                mission={mission}
                hideRecurrenceBadge
                actionSlot={
                  <button
                    type="button"
                    className="routine-builder-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(mission);
                    }}
                    disabled={isRemoving}
                    title="Remove from routine"
                    aria-label="Remove from routine"
                  >
                    <span className="material-icons">remove_circle_outline</span>
                  </button>
                }
              />
            );
          })}
        </div>
      )}
      <button
        type="button"
        className="routine-builder-add-bucket"
        onClick={onAdd}
      >
        <span className="material-icons">add</span>
        {ctaLabel}
      </button>
    </div>
  );
};

export default RoutineBuilderSection;
