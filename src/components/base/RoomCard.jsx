// src/components/base/RoomCard.js
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ENTIRE_BASE_ROOM_ID } from '../../services/roomService';
import {
  isCleanlinessStale,
  getCleanlinessSummary,
  CLEANLINESS_STALE_COLOR,
  CLEANLINESS_LABELS,
  CLEANLINESS_COLORS,
} from '../../utils/cleanlinessHelpers';
import './RoomCard.css';

const isImageIcon = (icon) => icon && icon.includes('.');

const RoomCard = ({ room, stats, onClick, isCustomOrderMode = false }) => {
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

  // Entire Base only — segmented bar + count summary
  const segments = isEntireBase ? (room.segments || []) : null;
  const summary = segments ? getCleanlinessSummary(segments) : null;
  const summaryParts = [];
  if (summary) {
    for (let level = 1; level <= 5; level++) {
      if (summary.byLevel[level] > 0) {
        summaryParts.push({
          key: `lvl-${level}`,
          count: summary.byLevel[level],
          label: CLEANLINESS_LABELS[level],
          color: CLEANLINESS_COLORS[level],
        });
      }
    }
    if (summary.stale > 0) {
      summaryParts.push({
        key: 'stale',
        count: summary.stale,
        label: 'Unchecked',
        color: CLEANLINESS_STALE_COLOR,
      });
    }
  }

  const showDragHandle = isCustomOrderMode && !isEntireBase;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`room-card${isDragging ? ' dragging' : ''}`}
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
          <>
            <div className="cleanliness-bar-container cleanliness-bar-segmented">
              {segments.length > 0 ? segments.map(seg => (
                <div
                  key={seg.id}
                  className="cleanliness-bar-segment"
                  style={{
                    backgroundColor: seg.stale ? CLEANLINESS_STALE_COLOR : CLEANLINESS_COLORS[seg.cleanliness],
                  }}
                />
              )) : (
                <div className="cleanliness-bar-segment cleanliness-bar-segment--empty" />
              )}
            </div>
            {summaryParts.length > 0 && (
              <p className="cleanliness-summary">
                {summaryParts.map((part, i) => (
                  <span key={part.key}>
                    {i > 0 && <span className="cleanliness-summary-sep"> · </span>}
                    <span style={{ color: part.color }}>{part.count} {part.label}</span>
                  </span>
                ))}
              </p>
            )}
          </>
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

      <div className="room-stats-grid">
        <div className={`stat-item${stats.total === 0 ? ' stat-zero' : ''}`}>
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Tasks</div>
        </div>
        <div className={`stat-item${stats.dueThisWeek === 0 ? ' stat-zero' : ''}`}>
          <div className="stat-number">{stats.dueThisWeek}</div>
          <div className="stat-label">This Week</div>
        </div>
        <div className={`stat-item${stats.overdue > 0 ? ' stat-late' : ' stat-zero'}`}>
          <div className="stat-number">{stats.overdue}</div>
          <div className="stat-label">Late</div>
        </div>
      </div>
    </div>
  );
};

export default RoomCard;
