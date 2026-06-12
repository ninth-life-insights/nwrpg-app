// src/components/routines/RoutineBuilderSection.jsx
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useDndContext,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
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
import { useNotifications } from '../../contexts/NotificationContext';
import {
  removeMissionFromRoutine,
  reorderRoutineMissions,
  setRoutineMissionCadence,
} from '../../services/routineService';
import { updateMission } from '../../services/missionService';
import { ENTIRE_BASE_ROOM_ID } from '../../services/roomService';
import {
  isMissionInRoutineSet,
  groupRoutineMissionsByFrequency,
  getMissionChainRoot,
  makeRoutineSortComparator,
  cadencePeriodDays,
  bucketForPeriodDays,
} from '../../utils/routineHelpers';
import {
  RECURRENCE_PATTERNS,
  isRecurringMission,
  isEvergreenMission,
  buildRecurrenceForBucket,
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
  const { notifyRoutineRebucketed } = useNotifications();
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

  // Optimistic recurrence overlay for recurring missions rebucketed via drag.
  // Keyed by mission ID (not chain root) because the recurrence config lives
  // on the mission doc itself, not the routine. Bucketing for recurring
  // missions reads mission.recurrence directly, so applying this overlay in
  // the grouped useMemo is how the card visibly lands in its new bucket
  // before the Firestore round-trip completes.
  const [pendingRecurrenceMap, setPendingRecurrenceMap] = useState(null);
  const recurrenceSeqRef = useRef(0);

  // Track which card is currently being dragged so DragOverlay can render a
  // continuous floating preview as the card moves across SortableContexts.
  const [activeDragId, setActiveDragId] = useState(null);

  // Source bucket captured at drag start. Read by the drop handler to
  // decide reorder vs. cross-bucket cadence change. In a ref so reads are
  // guaranteed-fresh and updates don't trigger re-renders.
  const dragSourceBucketRef = useRef(null);

  // Look up the active mission for the DragOverlay preview. Derived from
  // the raw missions prop (not from `grouped`) so this stays independent of
  // bucket assignments.
  const activeMission = useMemo(() => {
    if (!activeDragId) return null;
    return (missions || []).find((m) => m.id === activeDragId) || null;
  }, [activeDragId, missions]);

  const effectiveCadence = useMemo(() => {
    if (!pendingCadenceMap) return cadenceByChainRoot;
    const merged = { ...cadenceByChainRoot };
    for (const [rootId, cadence] of Object.entries(pendingCadenceMap)) {
      if (cadence == null) delete merged[rootId];
      else merged[rootId] = cadence;
    }
    return merged;
  }, [cadenceByChainRoot, pendingCadenceMap]);

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
    // Apply optimistic recurrence patches so a just-rebucketed recurring
    // mission visibly lands in its new bucket before the Firestore write
    // completes. Patch is keyed by mission ID and replaces only `recurrence`.
    const patched = pendingRecurrenceMap
      ? routineMissions.map((m) =>
          pendingRecurrenceMap[m.id]
            ? { ...m, recurrence: pendingRecurrenceMap[m.id] }
            : m
        )
      : routineMissions;
    // Sort by routine doc order before grouping — within-bucket order then
    // reflects the user's drag-to-reorder choices.
    const sorted = [...patched].sort(
      makeRoutineSortComparator(effectiveOrderMap)
    );
    return groupRoutineMissionsByFrequency(sorted, effectiveCadence);
  }, [missions, routineRootSet, roomFilter, skillFilter, effectiveOrderMap, effectiveCadence, pendingRecurrenceMap]);

  // Collision strategy — closestCenter ranks ALL droppables (cards + bucket
  // wrappers) by distance, then we filter to prefer cards. Bucket wrappers
  // would otherwise win whenever the cursor is in bucket whitespace OR
  // happens to be closer to the bucket's geometric center than to any one
  // card, which makes drops "snap to end of bucket" instead of slotting at
  // the cursor's actual card. Bucket fallback covers the empty-bucket case.
  //
  // closestCenter is permissive (always returns a collision), so this stays
  // reliable across fast drags and stable bucket layouts — unlike the
  // strict-pointer-within variant tried earlier.
  const collisionDetectionStrategy = useCallback((args) => {
    const collisions = closestCenter(args);
    const cardCollisions = collisions.filter((c) => {
      const container = args.droppableContainers.find((d) => d.id === c.id);
      return container?.data?.current?.type === 'card';
    });
    return cardCollisions.length > 0 ? cardCollisions : collisions;
  }, []);

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

  // Persisted-state bucket lookup for a chain root. Used by computeOrderForDrag
  // to find the insertion point when dropping on a bucket droppable (no
  // anchor card). Uses cadenceByChainRoot (not effectiveCadence) so the
  // live drag override doesn't affect where OTHER cards are considered to
  // live — the active card is filtered out before this is called.
  const bucketOfChainRoot = useCallback(
    (chainRoot) => {
      const m = (missions || []).find(
        (mm) => getMissionChainRoot(mm) === chainRoot
      );
      if (!m) return null;
      if (isEvergreenMission(m)) {
        const c = cadenceByChainRoot[chainRoot] || null;
        return bucketForPeriodDays(cadencePeriodDays(c));
      }
      if (isRecurringMission(m)) {
        return bucketForPeriodDays(cadencePeriodDays(m.recurrence));
      }
      return null;
    },
    [missions, cadenceByChainRoot]
  );

  // Compute the new global missionChainIds order for the drag's current
  // position. Returns null if there's no valid drop target (no over data,
  // active card not currently in the routine, etc.). Cross-bucket drops are
  // allowed for both evergreen and recurring missions — the parent handler
  // branches on type when persisting the cadence change.
  //
  // Insertion semantics use filter+splice with a cursor-position adjustment:
  // when over a card, inserting BEFORE the over card if the dragged
  // element's top is above the over card's vertical midpoint, AFTER if
  // below. Matches dnd-kit's multi-container example and produces a final
  // position that exactly matches the live preview. (Plain arrayMove on the
  // global array would drop one slot below the preview whenever the user
  // hovers on the bottom half of a card, which is most "drag below this"
  // intents.)
  const computeOrderForDrag = useCallback(
    (active, over, sourceBucket) => {
      const activeData = active?.data?.current;
      const overData = over?.data?.current;
      if (!activeData || !overData) return null;

      const overBucket = overData.bucketKey;
      if (!overBucket) return null;

      const activeChainRoot = activeData.chainRootId;
      const routine = routines.find((r) => r.id === routineId);
      if (!routine) return null;
      const baseChainIds = Array.isArray(routine.missionChainIds)
        ? routine.missionChainIds
        : [];
      if (baseChainIds.indexOf(activeChainRoot) === -1) return null;

      const filtered = baseChainIds.filter((id) => id !== activeChainRoot);

      if (overData.type === 'card' && overData.chainRootId) {
        const overIdx = filtered.indexOf(overData.chainRootId);
        if (overIdx === -1) return null;

        // Cursor-position check: if the dragged element's translated top is
        // past the over card's vertical midpoint, the user is reaching for
        // the slot BELOW the over card. Otherwise they're reaching for ABOVE.
        const activeRect = active?.rect?.current?.translated;
        const overRect = over?.rect;
        const insertAfter =
          activeRect &&
          overRect &&
          activeRect.top > overRect.top + overRect.height / 2;

        const insertIdx = insertAfter ? overIdx + 1 : overIdx;
        return [
          ...filtered.slice(0, insertIdx),
          activeChainRoot,
          ...filtered.slice(insertIdx),
        ];
      }

      if (overData.type === 'bucket') {
        // Insert after the last chain root currently in the target bucket.
        // If the bucket is empty (no other chain root maps to it), tack onto
        // the end of the global list.
        let lastIdx = -1;
        filtered.forEach((id, i) => {
          if (bucketOfChainRoot(id) === overBucket) lastIdx = i;
        });
        const insertIdx = lastIdx >= 0 ? lastIdx + 1 : filtered.length;
        return [
          ...filtered.slice(0, insertIdx),
          activeChainRoot,
          ...filtered.slice(insertIdx),
        ];
      }

      return null;
    },
    [routines, routineId, bucketOfChainRoot]
  );

  const handleDragStart = (event) => {
    setActiveDragId(event.active?.id ?? null);
    dragSourceBucketRef.current = event.active?.data?.current?.bucketKey ?? null;
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    dragSourceBucketRef.current = null;
  };

  // Drop handler. Decides reorder vs. cross-bucket using the source bucket
  // captured at drag start, then derives the final order with computeOrderForDrag
  // (cursor-position-aware) and persists. No live preview state to clean up —
  // within-bucket slot preview is handled natively by dnd-kit's SortableContext;
  // cross-bucket drag shows only the bucket tint + DragOverlay during drag and
  // the precise final slot appears on release via the optimistic pendingOrderMap.
  const handleDragEnd = async (event) => {
    setActiveDragId(null);
    const sourceBucket = dragSourceBucketRef.current;
    dragSourceBucketRef.current = null;

    const { active, over } = event;
    if (!over || !sourceBucket) return;

    const activeData = active.data?.current;
    const overData = over.data?.current;
    if (!activeData || !overData) return;

    const targetBucket = overData.bucketKey;
    if (!targetBucket) return;

    const newChainIds = computeOrderForDrag(active, over, sourceBucket);
    if (!newChainIds) return;

    const routine = routines.find((r) => r.id === routineId);
    const baseChainIds = Array.isArray(routine?.missionChainIds)
      ? routine.missionChainIds
      : [];
    const orderChanged =
      newChainIds.length !== baseChainIds.length ||
      newChainIds.some((id, i) => id !== baseChainIds[i]);
    const isCrossBucket = sourceBucket !== targetBucket;

    if (!orderChanged && !isCrossBucket) return;

    // Resolve the active mission so cross-bucket persistence branches on type:
    //   - Evergreen: routine-level cadence map controls bucketing → write to
    //     cadenceByChainRoot.
    //   - Recurring: mission.recurrence controls bucketing → rewrite the
    //     mission's recurrence config (anchored to current dueDate) so the
    //     rebucket actually sticks instead of snapping back.
    const dragMission = (missions || []).find((m) => m.id === active.id) || null;
    const isRecurringDrag = isCrossBucket && dragMission && isRecurringMission(dragMission);
    const isEvergreenDrag = isCrossBucket && dragMission && isEvergreenMission(dragMission);

    // Snapshot pre-drag state for the undo toast (cross-bucket only). Order is
    // captured because cross-bucket drops also reshuffle the global chain-ids
    // array; restoring just the cadence/recurrence without the order would
    // leave the card in a weird position after undo.
    const originalChainIds = isCrossBucket ? [...baseChainIds] : null;
    const originalCadence = isEvergreenDrag
      ? (cadenceByChainRoot?.[activeData.chainRootId] ?? null)
      : null;
    const originalRecurrence = isRecurringDrag && dragMission
      ? dragMission.recurrence ?? null
      : null;

    // Optimistically commit the order, and (for cross-bucket) either the
    // cadence (evergreen) or the recurrence (recurring), so the card visually
    // lands in its new slot before the Firestore round trip completes. Seq
    // guards keep stale completions from clobbering a newer drop's pending
    // state.
    const newMap = new Map();
    newChainIds.forEach((id, i) => newMap.set(id, i));
    const reorderSeq = ++reorderSeqRef.current;
    setPendingOrderMap(newMap);

    let cadenceSeq = null;
    let newCadence = null;
    let recurrenceSeq = null;
    let newRecurrence = null;
    if (isEvergreenDrag) {
      newCadence = bucketKeyToCadence(targetBucket);
      cadenceSeq = ++cadenceSeqRef.current;
      setPendingCadenceMap((prev) => ({
        ...(prev || {}),
        [activeData.chainRootId]: newCadence,
      }));
    } else if (isRecurringDrag) {
      newRecurrence = buildRecurrenceForBucket(targetBucket, dragMission.dueDate);
      recurrenceSeq = ++recurrenceSeqRef.current;
      setPendingRecurrenceMap((prev) => ({
        ...(prev || {}),
        [dragMission.id]: newRecurrence,
      }));
    }

    setActionError(null);
    try {
      if (isEvergreenDrag) {
        await setRoutineMissionCadence(
          currentUser.uid,
          routineId,
          activeData.chainRootId,
          newCadence
        );
      } else if (isRecurringDrag && newRecurrence) {
        await updateMission(currentUser.uid, dragMission.id, {
          recurrence: newRecurrence,
        });
      }
      if (orderChanged) {
        await reorderRoutineMissions(currentUser.uid, routineId, newChainIds);
      }
      await refreshRoutines();
      onSaved?.();
      if (reorderSeqRef.current === reorderSeq) setPendingOrderMap(null);
      if (cadenceSeq != null && cadenceSeqRef.current === cadenceSeq) {
        setPendingCadenceMap(null);
      }
      if (recurrenceSeq != null && recurrenceSeqRef.current === recurrenceSeq) {
        setPendingRecurrenceMap(null);
      }

      // Surface the undo affordance for cross-bucket drags only. Pure reorders
      // within the same bucket are low-stakes and don't earn a toast.
      if (isCrossBucket && dragMission) {
        const bucketLabel = BUCKETS.find((b) => b.key === targetBucket)?.label || targetBucket;
        notifyRoutineRebucketed({
          missionTitle: dragMission.title,
          bucketLabel,
          onUndo: async () => {
            try {
              if (isEvergreenDrag) {
                await setRoutineMissionCadence(
                  currentUser.uid,
                  routineId,
                  activeData.chainRootId,
                  originalCadence
                );
              } else if (isRecurringDrag) {
                await updateMission(currentUser.uid, dragMission.id, {
                  recurrence: originalRecurrence,
                });
              }
              if (originalChainIds) {
                await reorderRoutineMissions(currentUser.uid, routineId, originalChainIds);
              }
              await refreshRoutines();
              onSaved?.();
            } catch (undoErr) {
              console.error('Routine rebucket undo failed:', undoErr);
              setActionError("That undo didn't go through. Try again.");
            }
          },
        });
      }
    } catch (err) {
      console.error('Routine drag persist failed:', err);
      if (reorderSeqRef.current === reorderSeq) setPendingOrderMap(null);
      if (cadenceSeq != null && cadenceSeqRef.current === cadenceSeq) {
        setPendingCadenceMap(null);
      }
      if (recurrenceSeq != null && recurrenceSeqRef.current === recurrenceSeq) {
        setPendingRecurrenceMap(null);
      }
      setActionError(
        isCrossBucket
          ? "That move didn't save. Try again."
          : "That reorder didn't save. Try again."
      );
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
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
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
            onMissionChanged={onSaved}
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
                tintEvergreen
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
// receive a cross-bucket drag.
//
// The active-tint state is derived from useDndContext rather than
// useDroppable.isOver, because the collisionDetectionStrategy preferentially
// routes the over target to a card whenever any card is in range — so
// useDroppable.isOver on the bucket would only ever fire for the empty case.
// To get the tint to follow the drag into populated buckets too, we check
// "is the over target a card that belongs to my bucket?" in addition to the
// raw isOver signal.
const BucketDroppable = ({ bucketKey, children, className }) => {
  const { setNodeRef, isOver: isOverSelf } = useDroppable({
    id: `bucket:${bucketKey}`,
    data: { type: 'bucket', bucketKey },
  });
  const { active, over } = useDndContext();
  const overData = over?.data?.current;
  const overIsCardInThisBucket =
    overData?.type === 'card' && overData.bucketKey === bucketKey;
  const isActive = active != null && (isOverSelf || overIsCardInThisBucket);

  return (
    <div
      ref={setNodeRef}
      className={`${className || ''} ${isActive ? 'is-drop-target' : ''}`.trim()}
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
  onMissionChanged,
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
                return (
                  <SortableRoutineCard
                    key={mission.id}
                    mission={mission}
                    bucketKey={bucketKey}
                    chainRootId={root}
                    hideRecurrenceBadge
                    hideRoutineBadge
                    hideEvergreenBadge={false}
                    tintEvergreen
                    onMissionChanged={onMissionChanged}
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
