import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import './RoomSortModal.css';

const SORT_DEFAULT = 'custom';

const SORT_OPTIONS = [
  { value: 'custom',      label: 'Custom Order',  sub: 'Drag to reorder' },
  { value: 'name',        label: 'Name',          sub: 'A–Z' },
  { value: 'overdue',     label: 'Overdue Tasks', sub: 'Most first' },
  { value: 'cleanliness', label: 'Cleanliness',   sub: 'Lowest first' },
];

const RoomSortModal = ({ isOpen, onClose, currentSortBy, onApply }) => {
  const [sortBy, setSortBy] = useState(currentSortBy || SORT_DEFAULT);

  useModalBackButton(isOpen, onClose);

  useEffect(() => {
    setSortBy(currentSortBy || SORT_DEFAULT);
  }, [currentSortBy]);

  const handleApply = () => {
    onApply(sortBy);
    onClose();
  };

  const handleReset = () => {
    setSortBy(SORT_DEFAULT);
    onApply(SORT_DEFAULT);
    onClose();
  };

  if (!isOpen) return null;

  const isActive = sortBy !== SORT_DEFAULT;

  return createPortal(
    <div className="room-sort-overlay" onClick={onClose}>
      <div className="room-sort-modal" onClick={e => e.stopPropagation()}>

        <div className="room-sort-header">
          <h3>Sort Rooms</h3>
          <button className="room-sort-close" onClick={onClose} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="room-sort-content">
          <h4 className="room-sort-group-header">
            Sort by
            {isActive && <span className="room-sort-active-dot-inline" />}
          </h4>
          <div className="room-sort-options">
            {SORT_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={`room-sort-option${sortBy === opt.value ? ' selected' : ''}`}
              >
                <input
                  type="radio"
                  name="sortBy"
                  value={opt.value}
                  checked={sortBy === opt.value}
                  onChange={() => setSortBy(opt.value)}
                />
                <span className="room-sort-option-label">{opt.label}</span>
                {opt.sub && <span className="room-sort-option-sub">{opt.sub}</span>}
              </label>
            ))}
          </div>
        </div>

        <div className="room-sort-footer">
          <button className="room-sort-btn secondary" onClick={handleReset}>Reset to Default</button>
          <button className="room-sort-btn primary" onClick={handleApply}>Apply</button>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default RoomSortModal;
