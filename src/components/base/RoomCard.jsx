// src/components/base/RoomCard.js
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ENTIRE_BASE_ROOM_ID } from '../../services/roomService';
import {
  isCleanlinessStale,
  CLEANLINESS_STALE_COLOR,
  CLEANLINESS_COLORS,
} from '../../utils/cleanlinessHelpers';
import CleanlinessSegmentedBar from './CleanlinessSegmentedBar';
import './RoomCard.css';

const isImageIcon = (icon) => icon && icon.includes('.');

const RoomCard = ({
  room,
  stats,
  todayRoutineCount = 0,
  totalRoutineCount = 0,
  onClick,
  isCustomOrderMode = false,
}) => {
  const isEntireBase = room.id === ENTIRE_BASE_ROOM_ID || room.roomId === ENTIRE_BASE_ROOM_ID;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: room.id,
    disabled: !isCustomOrderMode || isEntireBase,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const stale = !isEntireBase && isCleanlinessStale(room);
  const cleanlinessColor = stale ? CLEANLINESS_STALE_COLOR : (CLEANLINESS_COLORS[room.cleanliness] || CLEANLINESS_COLORS[3]);
  const cleanlinessPercentage = (room.cleanliness / 5) * 100;

  // Entire Base only — segmented bar (one slice per non-base room)
  const segments = isEntireBase ? (room.segments || []) : null;

  const showDragHandle = isCustomOrderMode && !isEntireBase;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`room-card${isDragging ? ' dragging' : ''}${isEntireBase ? ' entire-base' : ''}`}
      onClick={onClick}
      {...attributes}
    >
      {showDragHandle && (
        <div
          className="room-card-drag-handle"
          onClick={(e) => e.stopPropagation()}
          {...listeners}
          style={{ touchAction: 'none' }}
          aria-label="Drag to reorder room"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/>
            <circle cx="15" cy="6" r="1.5"/>
            <circle cx="15" cy="12" r="1.5"/>
            <circle cx="15" cy="18" r="1.5"/>
          </svg>
        </div>
      )}

      <div className="room-card-header">
        <div className="room-icon">
          {isImageIcon(room.icon)
            ? <img src={`/assets/Rooms/${room.icon}`} alt={room.name} className="room-card-icon-img" />
            : <span className="material-icons">{room.icon}</span>
          }
        </div>
        <h3 className="room-name">{room.name}</h3>
      </div>

      <div className="cleanliness-section">
        {isEntireBase ? (
          <CleanlinessSegmentedBar segments={segments} />
        ) : (
          <div className="cleanliness-bar-container">
            <div
              className="cleanliness-bar-fill"
              style={{
                width: `${cleanlinessPercentage}%`,
                backgroundColor: cleanlinessColor,
              }}
            />
          </div>
        )}
      </div>

      {/* Action strips — the two signals that drive decisions on this
          card: today's routine (rhythm) and overdue (urgency). Always
          rendered (dimmed at zero) so grid row heights stay stable
          regardless of room state. */}
      <div className="room-card-strips">
        <div className={`room-card-strip room-card-strip--routine${todayRoutineCount === 0 ? ' is-zero' : ''}`}>
          <span className="room-card-strip-label">Today's routine</span>
          <span className="room-card-strip-count">{todayRoutineCount}</span>
        </div>
        <div className={`room-card-strip room-card-strip--overdue${stats.overdue === 0 ? ' is-zero' : ''}`}>
          <span className="room-card-strip-label">Overdue</span>
          <span className="room-card-strip-count">{stats.overdue}</span>
        </div>
      </div>

      {/* Broader overview — volume + routine breakdown, same lean text-
          line treatment as the room page header. Clauses silent when zero. */}
      <p className="room-card-stat-line">
        {stats.total === 0
          ? 'No tasks here yet'
          : `${stats.total} task${stats.total !== 1 ? 's' : ''}${totalRoutineCount > 0 ? ` · ${totalRoutineCount} in routine` : ''}`}
      </p>
    </div>
  );
};

export default RoomCard;
