// src/components/routines/RoutineBuilderSection.jsx
import { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import QuickAddRoutineSheet from './QuickAddRoutineSheet';
import AddExistingRecurringModal from './AddExistingRecurringModal';
import SortableRoutineCard from './SortableRoutineCard';
// MissionCardCondensed is now wrapped by SortableRoutineCard; no direct import needed.
import ErrorMessage from '../ui/ErrorMessage';
import { useAuth } from '../../contexts/AuthContext';
import { useRooms } from '../../contexts/RoomsContext';
import { useRoutines } from '../../contexts/RoutineContext';
import {
  removeMissionFromRoutine,
  reorderRoutineMissions,
} from '../../services/routineService';
import { ENTIRE_BASE_ROOM_ID } from '../../services/roomService';
import {
  isMissionInRoutineSet,
  groupRoutineMissionsByFrequency,
  getMissionChainRoot,
  makeRoutineSortComparator,
} from '../../utils/routineHelpers';
import { RECURRENCE_PATTERNS } from '../../utils/recurrenceHelpers';
import { AVAILABLE_SKILLS } from '../../data/Skills';
import './RoutineBuilderSection.css';

const BUCKETS = [
  { key: 'daily',   frequency: RECURRENCE_PATTERNS.DAILY,   label: 'Daily' },
  { key: 'weekly',  frequency: RECURRENCE_PATTERNS.WEEKLY,  label: 'Weekly' },
  { key: 'monthly', frequency: RECURRENCE_PATTERNS.MONTHLY, label: 'Monthly' },
  { key: 'yearly',  frequency: RECURRENCE_PATTERNS.YEARLY,  label: 'Yearly' },
];

// Sentinel for the "no specific room" filter option — selects missions with
// no baseLocation. User-facing label is "Personal" because the prototypical
// case is non-cleaning routines (self-care, bills, calls, etc), not because
// the data field literally means personal. Don't confuse the two if you're
// adding more filter options.
export const NO_ROOM_FILTER = '__no_room__';

// The Builder is a noticing surface, not a planning form. Each frequency
// bucket is always visible (even empty) — the layout teaches the cadence model.
// Adds happen contextually from each bucket via QuickAddRoutineSheet, which
// inherits the active filters so common scenarios ("I'm noticing Kitchen
// cleaning stuff") become low-friction.
const RoutineBuilderSection = ({
  missions,
  routineRootSet,
  routineId,
  onSaved,
}) => {
  const { currentUser } = useAuth();
  const { rooms } = useRooms();
  const { routines, routineOrderMap, refreshRoutines } = useRoutines();

  const [roomFilter, setRoomFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [addBucketFrequency, setAddBucketFrequency] = useState(null);
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [removingRootIds, setRemovingRootIds] = useState(new Set());
  const [collapsedBuckets, setCollapsedBuckets] = useState(new Set());

  // Optimistic order overlay. Set immediately when the user drops a drag so
  // the UI reflects the new position without waiting for the Firestore round
  // trip. Cleared when the matching refresh completes; the seq ref guards
  // against a stale completion clearing a newer drag's pending state.
  const [pendingOrderMap, setPendingOrderMap] = useState(null);
  const reorderSeqRef = useRef(0);
  const effectiveOrderMap = pendingOrderMap || routineOrderMap;

  // "Last used" session controls — persist across QuickAddRoutineSheet opens
  // during this page visit so batch-setup (e.g. "I'm adding 6 cleaning tasks
  // across 3 rooms") doesn't require re-picking Skill on every sheet open.
  // null means "not yet set this session" — falls back to page filter or empty.
  const [lastSkill, setLastSkill] = useState(null);
  const [lastRoom, setLastRoom] = useState(null);

  const grouped = useMemo(() => {
    const routineMissions = (missions || []).filter((m) => {
      if (!isMissionInRoutineSet(m, routineRootSet)) return false;
      if (roomFilter === NO_ROOM_FILTER) {
        if (m.baseLocation) return false;
      } else if (roomFilter && m.baseLocation !== roomFilter) {
        return false;
      }
      if (skillFilter && m.skill !== skillFilter) return false;
      return true;
    });
    // Sort by routine doc order before grouping — within-bucket order then
    // reflects the user's drag-to-reorder choices.
    const sorted = [...routineMissions].sort(
      makeRoutineSortComparator(effectiveOrderMap)
    );
    return groupRoutineMissionsByFrequency(sorted);
  }, [missions, routineRootSet, roomFilter, skillFilter, effectiveOrderMap]);

  // Drag sensors — TouchSensor delays activation 150ms so a tap to open the
  // mission still works. PointerSensor needs 8px movement so a click on the
  // handle doesn't accidentally start a drag.
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Move items within a bucket. Translates the visible drag into a write to
  // the routine doc's missionChainIds (replacing only the global indexes the
  // bucket's items occupy, so other buckets keep their relative order).
  const handleBucketDragEnd = async (event, bucketKey) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const bucketMissions = grouped[bucketKey] || [];
    const oldIndex = bucketMissions.findIndex((m) => m.id === active.id);
    const newIndex = bucketMissions.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newBucketMissions = arrayMove(bucketMissions, oldIndex, newIndex);
    const newBucketRoots = newBucketMissions.map((m) => getMissionChainRoot(m));

    const routine = routines.find((r) => r.id === routineId);
    if (!routine) return;
    const currentChainIds = Array.isArray(routine.missionChainIds)
      ? routine.missionChainIds
      : [];

    // Find the global indexes the bucket's items currently occupy.
    const bucketRootSet = new Set(
      bucketMissions.map((m) => getMissionChainRoot(m))
    );
    const occupiedIndexes = [];
    currentChainIds.forEach((id, i) => {
      if (bucketRootSet.has(id)) occupiedIndexes.push(i);
    });

    // Write the new bucket order into those slots.
    const newChainIds = [...currentChainIds];
    newBucketRoots.forEach((rootId, i) => {
      if (i < occupiedIndexes.length) {
        newChainIds[occupiedIndexes[i]] = rootId;
      }
    });

    // Optimistically reflect the new order in the UI before the round trip
    // completes — otherwise the dragged card snaps back to its original
    // slot until the refresh lands. The seq counter lets a newer drag's
    // pending state survive an older drag's completion.
    const optimisticMap = new Map();
    newChainIds.forEach((id, i) => optimisticMap.set(id, i));
    const mySeq = ++reorderSeqRef.current;
    setPendingOrderMap(optimisticMap);

    setActionError(null);
    try {
      await reorderRoutineMissions(currentUser.uid, routineId, newChainIds);
      await refreshRoutines();
      onSaved?.();
      if (reorderSeqRef.current === mySeq) {
        setPendingOrderMap(null);
      }
    } catch (err) {
      console.error('Routine reorder failed:', err);
      if (reorderSeqRef.current === mySeq) {
        setPendingOrderMap(null);
      }
      setActionError("That reorder didn't save. Try again.");
    }
  };

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

  const toggleCollapsed = (key) => {
    setCollapsedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Resolve defaults for the QuickAddRoutineSheet. Order of precedence:
  //   1. lastSkill / lastRoom from this session — user's most recent intent
  //   2. Page filter — what they're currently looking at
  //   3. Empty / "Personal"
  // Page filter only seeds the room when it names a specific room (NO_ROOM
  // and Any both fall through to the empty default).
  const sheetDefaultSkill = lastSkill !== null ? lastSkill : skillFilter;
  const sheetDefaultRoom = lastRoom !== null
    ? lastRoom
    : (roomFilter && roomFilter !== NO_ROOM_FILTER ? roomFilter : '');

  return (
    <section className="routine-builder">
      <p className="routine-builder-intro">
        Routines are the rhythms that keep things running. Add what should be automatic.
      </p>

      <div className="routine-builder-filters">
        <label className="routine-builder-filter">
          <span className="routine-builder-filter-label">Skill</span>
          <select
            className="routine-builder-filter-select"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
          >
            <option value="">Any</option>
            {AVAILABLE_SKILLS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {rooms.length > 0 && (
          <label className="routine-builder-filter">
            <span className="routine-builder-filter-label">Room</span>
            <select
              className="routine-builder-filter-select"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
            >
              <option value="">Any</option>
              <option value={NO_ROOM_FILTER}>Personal</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.id === ENTIRE_BASE_ROOM_ID ? 'Entire Base' : room.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="routine-builder-top-actions">
        <button
          type="button"
          className="routine-builder-cta"
          onClick={() => setShowAddExisting(true)}
        >
          <span className="material-icons">playlist_add</span>
          Add existing tasks
        </button>
      </div>

      {actionError && <ErrorMessage message={actionError} />}

      {BUCKETS.map((bucket) => (
        <FrequencyGroup
          key={bucket.key}
          bucketKey={bucket.key}
          label={bucket.label}
          missions={grouped[bucket.key]}
          collapsed={collapsedBuckets.has(bucket.key)}
          onToggleCollapsed={() => toggleCollapsed(bucket.key)}
          onAdd={() => setAddBucketFrequency(bucket.frequency)}
          onRemove={handleRemove}
          removingRootIds={removingRootIds}
          sensors={sensors}
          onDragEnd={handleBucketDragEnd}
        />
      ))}

      {addBucketFrequency && (
        <QuickAddRoutineSheet
          frequency={addBucketFrequency}
          routineId={routineId}
          defaultRoomId={sheetDefaultRoom}
          defaultSkill={sheetDefaultSkill}
          onSkillChange={setLastSkill}
          onRoomChange={setLastRoom}
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
          skillFilter={skillFilter}
          onClose={() => setShowAddExisting(false)}
          onSaved={onSaved}
        />
      )}
    </section>
  );
};

const FrequencyGroup = ({
  bucketKey,
  label,
  missions,
  collapsed,
  onToggleCollapsed,
  onAdd,
  onRemove,
  removingRootIds,
  sensors,
  onDragEnd,
}) => {
  const list = missions || [];
  const isEmpty = list.length === 0;
  const showList = !isEmpty && !collapsed;

  return (
    <div className={`routine-builder-group ${isEmpty ? 'is-empty' : ''}`}>
      <div
        className="routine-builder-group-header"
        onClick={isEmpty ? undefined : onToggleCollapsed}
        role={isEmpty ? undefined : 'button'}
        tabIndex={isEmpty ? undefined : 0}
        onKeyDown={
          isEmpty
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleCollapsed();
                }
              }
        }
      >
        <div className="routine-builder-group-titlewrap">
          {!isEmpty && (
            <span
              className={`material-icons routine-builder-group-chevron ${collapsed ? 'is-collapsed' : ''}`}
              aria-hidden="true"
            >
              expand_more
            </span>
          )}
          <h3 className="routine-builder-group-label">{label}</h3>
          <span className="routine-builder-group-count">{list.length}</span>
        </div>
        <button
          type="button"
          className="routine-builder-group-add"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          aria-label={`Add to ${label}`}
        >
          <span className="material-icons">add</span>
          Add
        </button>
      </div>

      {showList && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => onDragEnd(event, bucketKey)}
        >
          <SortableContext
            items={list.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="routine-builder-group-list">
              {list.map((mission) => {
                const root = getMissionChainRoot(mission);
                const isRemoving = removingRootIds.has(root);
                return (
                  <SortableRoutineCard
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
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export default RoutineBuilderSection;
