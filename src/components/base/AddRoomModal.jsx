// src/components/rooms/AddRoomModal.js
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createRoom } from '../../services/roomService';
import ErrorMessage from '../ui/ErrorMessage';
import './AddRoomModal.css';

const ROOM_ICONS = [
  { value: 'Room-bed.jpg',     label: 'Bedroom' },
  { value: 'Room-couch.jpg',   label: 'Living Room' },
  { value: 'Room-TV.jpg',      label: 'TV Room' },
  { value: 'Room-dining.jpg',  label: 'Dining Room' },
  { value: 'Room-Shower.jpg',  label: 'Bathroom' },
  { value: 'Room-toilet.jpg',  label: 'Toilet' },
  { value: 'Room-kitchen.jpg', label: 'Kitchen' },
  { value: 'Room-craft.jpg',   label: 'Craft Room' },
  { value: 'Room-entry.jpg',   label: 'Entryway' },
];

const AddRoomModal = ({ onClose, onRoomAdded }) => {
  const { currentUser } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ROOM_ICONS[0].value);
  const [cleanliness, setCleanliness] = useState(3);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setSaveError(null);
    setSaving(true);
    try {
      await createRoom(currentUser.uid, {
        name: roomName.trim(),
        icon: selectedIcon,
        cleanliness,
      });
      onRoomAdded();
    } catch (err) {
      console.error('Error creating room:', err);
      setSaveError("That room didn't save. Try again.");
      setSaving(false);
    }
  };

  const getCleanlinessLabel = (value) => {
    const labels = {
      1: 'Messy',
      2: 'Needs help',
      3: 'Workable',
      4: 'Clean',
      5: 'Spotless'
    };
    return labels[value];
  };

  const getCleanlinessColor = (value) => {
    const colors = {
      1: '#ef4444',
      2: '#f97316',
      3: '#eab308',
      4: '#84cc16',
      5: '#10b981'
    };
    return colors[value];
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-room-modal-compact" onClick={(e) => e.stopPropagation()}>
        <button className="close-button-compact" onClick={onClose}>
          <span className="material-icons">close</span>
        </button>

        <form onSubmit={handleSubmit}>
          {/* Room Name Input */}
          <input
            type="text"
            className="room-name-input"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Room name (e.g., Kitchen)"
            autoFocus
          />

          {/* Icon Picker - Single Row Scroll */}
          <div className="icon-scroll-container">
            <div className="icon-scroll">
              {ROOM_ICONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`icon-option-compact ${selectedIcon === value ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(value)}
                  title={label}
                >
                  <img
                    src={`/assets/Rooms/${value}`}
                    alt={label}
                    className="icon-option-img"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Cleanliness Slider */}
          <div className="cleanliness-section">
            <div className="cleanliness-label" style={{ color: getCleanlinessColor(cleanliness) }}>
              {getCleanlinessLabel(cleanliness)}
            </div>
            <div className="cleanliness-slider-compact">
              <input
                type="range"
                min="1"
                max="5"
                value={cleanliness}
                onChange={(e) => setCleanliness(parseInt(e.target.value))}
                className="slider-input"
              />
            </div>
          </div>

          {saveError && <ErrorMessage message={saveError} />}

          {/* Submit Button */}
          <button
            type="submit"
            className="submit-button-compact"
            disabled={saving || !roomName.trim()}
          >
            {saving ? 'Adding...' : 'Add Room'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddRoomModal;