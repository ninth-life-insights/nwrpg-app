// src/components/routines/SortableRoutineCard.jsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import './SortableRoutineCard.css';

// Wraps MissionCardCondensed with a drag handle so the builder can reorder
// items within a frequency bucket AND drag them across buckets to change
// the routine cadence. Handle is on the right side of the row; the existing
// actionSlot (remove-from-routine icon) sits beside it. Card body behavior
// (click → MissionCardFull, etc.) is unaffected.
//
// Both evergreen and recurring missions support cross-bucket drag — the
// parent handler branches on type when persisting (evergreens write to the
// routine's cadence map; recurring missions get their recurrence config
// rewritten to match the target bucket, anchored to the current dueDate).
//
// Props:
//   bucketKey   — current bucket ('daily'|'weekly'|'monthly'|'yearly').
//                 Surfaced via useSortable's `data` so the parent
//                 DndContext's onDragEnd can detect cross-bucket drops.
//   chainRootId — the mission chain's root ID. Also passed through data
//                 so the drop handler doesn't have to re-derive it.
const SortableRoutineCard = ({
  mission,
  actionSlot,
  bucketKey,
  chainRootId,
  ...rest
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: mission.id,
    data: {
      type: 'card',
      bucketKey,
      chainRootId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  // Compose the drag handle alongside the caller-provided actionSlot so a
  // single right-side cluster holds both reorder + remove. The handle stops
  // pointer-event propagation so dragging it never triggers the card body's
  // tap-to-edit.
  const combinedSlot = (
    <div className="sortable-routine-actions">
      {actionSlot}
      <button
        type="button"
        className="sortable-routine-handle"
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
        aria-label="Drag to reorder or move bucket"
        title="Drag to reorder or change cadence"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="material-icons">drag_indicator</span>
      </button>
    </div>
  );

  return (
    <div ref={setNodeRef} style={style} className="sortable-routine-card">
      <MissionCardCondensed
        mission={mission}
        actionSlot={combinedSlot}
        {...rest}
      />
    </div>
  );
};

export default SortableRoutineCard;
