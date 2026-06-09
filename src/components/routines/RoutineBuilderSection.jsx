// src/components/routines/RoutineBuilderSection.jsx
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useDroppable,
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
import MissionCardCondensed from '../missions/MissionCardCondensed';
import ErrorMessage from '../ui/ErrorMessage';
import { useAuth } from '../../contexts/AuthContext';
import { useRooms } from '../../contexts/RoomsContext';
import { useRoutines } from '../../contexts/RoutineContext';
import {
  removeMissionFromRoutine,
  reorderRoutineMissions,
  setRoutineMissionCadence,
} from '../../services/routineService';
import { ENTIRE_BASE_ROOM_ID } from '../../services/roomService';
import {
  isMissionInRoutineSet,
  groupRoutineMissionsByFrequency,
  getMissionChainRoot,
  makeRoutineSortComparator,
} from '../../utils/routineHelpers';
import {
  RECURRENCE_PATTERNS,
  isRecurringMission,
} from '../../utils/recurrenceHelpers';
import { AVAILABLE_SKILLS } from '../../data/Skills';
import './RoutineBuilderSection.css';

// View paths attach to the buckets they visualize — categorically "Week
// view" lives with "Weekly," "Month view" lives with "Monthly." Putting
// them up at the top-actions row implied they were peers with creation
// actions, which they aren't (they're alternate visualizations of the
// cadence, scoped to the same bucket).
const BUCKETS = [
  { key: 'daily',   frequency: RECURRENCE_PATTERNS.DAILY,   label: 'Daily',   icon: 'today' },
  { key: 'weekly',  frequency: RECURRENCE_PATTERNS.WEEKLY,  label: 'Weekly',  icon: 'view_week',      viewPath: '/routine-builder/week-view',  viewLabel: 'Week view' },
  { key: 'monthly', frequency: RECURRENCE_PATTERNS.MONTHLY, label: 'Monthly', icon: 'calendar_month', viewPath: '/routine-builder/month-view', viewLabel: 'Month view' },
  { key: 'yearly',  frequency: RECURRENCE_PATTERNS.YEARLY,  label: 'Yearly',  icon: 'view_timeline' },
];

// Sentinel for the "no specific room" filter option — selects missions with
// no baseLocation. User-facing label is "Personal" because the prototypical
// case is non-cleaning routines (self-care, bills, calls, etc), not because
// the data field literally means personal. Don't confuse the two if you're
// adding more filter options.
export const NO_ROOM_FILTER = '__no_room__';

// Translate bucket key → cadence object stored on the routine. Daily is the
// default state (absence from the cadence map), so we return null to signal
// "clear the entry" to setRoutineMissionCadence.
const bucketKeyToCadence = (bucketKey) => {
  if (bucketKey === 'daily') return null;
  return { pattern: bucketKey, interval: 1 };
};

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
  const { routines, routineOrderMap, cadenceByChainRoot, refreshRoutines } = useRoutines();
  const navigate = useNavigate();

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

  // Optimistic cadence overlay. Same shape as the routine doc's
  // cadenceByChainRoot, but explicit `null` values mean "explicitly back to
  // daily" (so the merge below knows to remove a context entry, not keep it).
  // Latest-drag-wins via cadenceSeqRef, mirroring pendingOrderMap.
  const [pendingCadenceMap, setPendingCadenceMap] = useState(null);
  const cadenceSeqRef = useRef(0);

  // Track which card is currently being dragged so DragOverlay can render a
  // continuous floating preview as the card moves across SortableContexts.
  // (Without an overlay, dnd-kit's default visual hides on cross-container
  // drag.)
  const [activeDragId, setActiveDragId] = useState(null);

  // Live cross-bucket preview: while a drag is in flight, the dragged card
  // visually relocates to whichever bucket the cursor is currently over. This
  // gives cross-bucket drag the same "slot opens up" feedback as within-bucket
  // reorder, instead of just a bucket tint. Set in onDragOver, cleared on
  // drag end/cancel.
  const [dragOverBucket, setDragOverBucket] = useState(null);

  // Captured at drag start. Needed because the live preview reassigns the
  // card to the target bucket during drag — by the time the drop fires, the
  // card's `data.bucketKey` reflects the target, not the original. Held in a
  // ref so reads in the drop handler are guaranteed-fresh (no React state
  // batching to worry about) and updates don't trigger re-renders.
  const dragSourceBucketRef = useRef(null);

  // Look up the active mission directly from the raw missions prop so the
  // memo doesn't depend on `grouped` (which would create a cycle: grouped
  // depends on effectiveCadence, which would depend on activeMission).
  const activeMission = useMemo(() => {
    if (!activeDragId) return null;
    return (missions || []).find((m) => m.id === activeDragId) || null;
  }, [activeDragId, missions]);

  const activeIsCadenceLocked = activeMission
    ? isRecurringMission(activeMission)
    : false;

  const effectiveCadence = useMemo(() => {
    const merged = { ...cadenceByChainRoot };
    if (pendingCadenceMap) {
      for (const [rootId, cadence] of Object.entries(pendingCadenceMap)) {
        if (cadence == null) delete merged[rootId];
        else merged[rootId] = cadence;
      }
    }
    // Live drag override — only for cadence-editable (evergreen) cards.
    // Recurring cards stay in their natural bucket during drag so the user
    // sees they can't actually be moved.
    if (activeMission && dragOverBucket && !activeIsCadenceLocked) {
      const chainRoot = getMissionChainRoot(activeMission);
      const liveCadence = bucketKeyToCadence(dragOverBucket);
      if (liveCadence == null) delete merged[chainRoot];
      else merged[chainRoot] = liveCadence;
    }
    return merged;
  }, [
    cadenceByChainRoot,
    pendingCadenceMap,
    activeMission,
    dragOverBucket,
    activeIsCadenceLocked,
  ]);

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
    return groupRoutineMissionsByFrequency(sorted, effectiveCadence);
  }, [missions, routineRootSet, roomFilter, skillFilter, effectiveOrderMap, effectiveCadence]);

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

  // Same-bucket reorder. Translates the visible drag into a write to the
  // routine doc's missionChainIds (replacing only the global indexes the
  // bucket's items occupy, so other buckets keep their relative order).
  const reorderWithinBucket = async (bucketKey, activeId, overId) => {
    const bucketMissions = grouped[bucketKey] || [];
    const oldIndex = bucketMissions.findIndex((m) => m.id === activeId);
    const newIndex = bucketMissions.findIndex((m) => m.id === overId);
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

  // Cross-bucket move = change the routine cadence for this chain root.
  // Recurring missions are silently no-op'd here (their cadence is intrinsic
  // and surfaced via their own recurrence config — see SortableRoutineCard's
  // isCadenceLocked).
  const moveToBucket = async (chainRootId, targetBucketKey, isCadenceLocked) => {
    if (!chainRootId || !targetBucketKey) return;
    if (isCadenceLocked) return;

    const newCadence = bucketKeyToCadence(targetBucketKey);

    const mySeq = ++cadenceSeqRef.current;
    setPendingCadenceMap((prev) => ({
      ...(prev || {}),
      [chainRootId]: newCadence, // null is a meaningful "back to daily" value
    }));

    setActionError(null);
    try {
      await setRoutineMissionCadence(
        currentUser.uid,
        routineId,
        chainRootId,
        newCadence
      );
      await refreshRoutines();
      onSaved?.();
      if (cadenceSeqRef.current === mySeq) {
        setPendingCadenceMap(null);
      }
    } catch (err) {
      console.error('Routine cadence change failed:', err);
      if (cadenceSeqRef.current === mySeq) {
        setPendingCadenceMap(null);
      }
      setActionError("That cadence change didn't save. Try again.");
    }
  };

  const handleDragStart = (event) => {
    setActiveDragId(event.active?.id ?? null);
    dragSourceBucketRef.current = event.active?.data?.current?.bucketKey ?? null;
    setDragOverBucket(null);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setDragOverBucket(null);
    dragSourceBucketRef.current = null;
  };

  // Live container tracking — fires continuously during drag. We only commit
  // a state update when the bucket under the cursor actually changes, to
  // avoid churning React on every pointer move.
  const handleDragOver = (event) => {
    const overBucket = event.over?.data?.current?.bucketKey ?? null;
    setDragOverBucket((prev) => (prev === overBucket ? prev : overBucket));
  };

  // Unified drop handler. Compares the ORIGINAL source bucket (captured at
  // drag start, before the live preview reassignment) against the drop
  // target's bucket to decide reorder vs. cross-bucket cadence change.
  const handleDragEnd = (event) => {
    setActiveDragId(null);
    setDragOverBucket(null);
    const sourceBucket = dragSourceBucketRef.current;
    dragSourceBucketRef.current = null;

    const { active, over } = event;
    if (!over || !sourceBucket) return;

    const activeData = active.data?.current;
    const overData = over.data?.current;
    if (!activeData || !overData) return;

    const targetBucket = overData.bucketKey;
    if (!targetBucket) return;

    if (sourceBucket === targetBucket) {
      // Reorder within bucket. Skip if dropped on the bucket-itself droppable
      // (no anchor card to slot against) — that's a no-op.
      if (overData.type !== 'card') return;
      if (active.id === over.id) return;
      reorderWithinBucket(sourceBucket, active.id, over.id);
      return;
    }

    // Cross-bucket move. Honor the cadence lock on the dragged card.
    moveToBucket(activeData.chainRootId, targetBucket, activeData.isCadenceLocked);
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

  const isDragActive = activeDragId != null;

  return (
    <section className="routine-builder">
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

      {/* Single DndContext at the section level lets drag move across the
          per-bucket SortableContexts without losing pointer tracking. */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {BUCKETS.map((bucket) => (
          <FrequencyGroup
            key={bucket.key}
            bucketKey={bucket.key}
            label={bucket.label}
            icon={bucket.icon}
            missions={grouped[bucket.key]}
            collapsed={collapsedBuckets.has(bucket.key)}
            onToggleCollapsed={() => toggleCollapsed(bucket.key)}
            onAdd={() => setAddBucketFrequency(bucket.frequency)}
            onView={bucket.viewPath ? () => navigate(bucket.viewPath) : undefined}
            viewLabel={bucket.viewLabel}
            onRemove={handleRemove}
            removingRootIds={removingRootIds}
            isDragActive={isDragActive}
          />
        ))}

        <DragOverlay>
          {activeMission ? (
            <div className="routine-builder-drag-preview">
              <MissionCardCondensed
                mission={activeMission}
                hideRecurrenceBadge
                hideRoutineBadge
                hideEvergreenBadge={false}
                readOnly
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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

// Bucket-level droppable wrapper. Registers the bucket itself as a drop
// target (separate from the cards inside it) so an empty bucket can still
// receive a cross-bucket drag, and so cards dropped on the bucket's open
// space (not on another card) still route through the cadence handler.
const BucketDroppable = ({ bucketKey, children, className }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `bucket:${bucketKey}`,
    data: { type: 'bucket', bucketKey },
  });
  return (
    <div
      ref={setNodeRef}
      className={`${className || ''} ${isOver ? 'is-drop-target' : ''}`.trim()}
    >
      {children}
    </div>
  );
};

const FrequencyGroup = ({
  bucketKey,
  label,
  icon,
  missions,
  collapsed,
  onToggleCollapsed,
  onAdd,
  onView,
  viewLabel,
  onRemove,
  removingRootIds,
  isDragActive,
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
        <div className="routine-builder-group-actions">
          {onView && (
            <button
              type="button"
              className="routine-builder-group-view"
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
              aria-label={viewLabel || `Open ${label} view`}
            >
              <span className="material-icons">zoom_out_map</span>
              {viewLabel || 'View'}
            </button>
          )}
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
      </div>

      {/* Bucket body is always droppable so cross-bucket drag can land here.
          When the bucket has cards, the SortableContext also enables
          within-bucket reorder. Empty buckets show a hint only while a drag
          is in flight so the resting state stays uncluttered. */}
      <BucketDroppable bucketKey={bucketKey} className="routine-builder-bucket-dropzone">
        {showList ? (
          <SortableContext
            items={list.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="routine-builder-group-list">
              {list.map((mission) => {
                const root = getMissionChainRoot(mission);
                const isRemoving = removingRootIds.has(root);
                const isLocked = isRecurringMission(mission);
                return (
                  <SortableRoutineCard
                    key={mission.id}
                    mission={mission}
                    bucketKey={bucketKey}
                    chainRootId={root}
                    isCadenceLocked={isLocked}
                    hideRecurrenceBadge
                    hideRoutineBadge
                    hideEvergreenBadge={false}
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
        ) : isEmpty && isDragActive ? (
          <div className="routine-builder-bucket-empty-hint">
            Drop here to move to {label}
          </div>
        ) : null}
      </BucketDroppable>
    </div>
  );
};

export default RoutineBuilderSection;
