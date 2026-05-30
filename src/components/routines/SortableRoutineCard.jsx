// src/components/routines/SortableRoutineCard.jsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import './SortableRoutineCard.css';

// Wraps MissionCardCondensed with a drag handle so the builder can reorder
// items within a frequency bucket. Handle is on the right side of the row;
// the existing actionSlot (remove-from-routine icon) sits beside it.
// Card body behavior (click → MissionCardFull, etc.) is unaffected.
const SortableRoutineCard = ({ mission, actionSlot, ...rest }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mission.id });

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
        aria-label="Drag to reorder"
        title="Drag to reorder"
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
