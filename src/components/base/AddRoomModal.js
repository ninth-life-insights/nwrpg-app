// src/components/rooms/AddRoomModal.js
import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createRoom } from '../../services/roomService';
import './AddRoomModal.css';

// Common room icons
const ROOM_ICONS = [
  'kitchen',
  'bed',
  'bathroom',
  'living_room',
  'dining_room',
  'garage',
  'yard',
  'balcony',
  'office',
  'child_care',
  'pets',
  'fitness_center',
  'local_laundry_service',
  'room',
  'meeting_room',
  'storage',
  'stairs',
  'deck',
  'home',
  'door_front'
];

const AddRoomModal = ({ onClose, onRoomAdded }) => {
  const { currentUser } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('room');
  const [cleanliness, setCleanliness] = useState(3);
  const [saving, setSaving] = useState(false);
  const iconScrollRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!roomName.trim()) return;

    try {
      setSaving(true);
      
      await createRoom(currentUser.uid, {
        name: roomName.trim(),
        icon: selectedIcon,
        cleanliness: cleanliness
      });
      
      onRoomAdded();
    } catch (err) {
      console.error('Error creating room:', err);
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
          <div className="icon-scroll-container" ref={iconScrollRef}>
            <div className="icon-scroll">
              {ROOM_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`icon-option-compact ${selectedIcon === icon ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(icon)}
                >
                  <span className="material-icons">{icon}</span>
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
                style={{
                  '--slider-color': getCleanlinessColor(cleanliness)
                }}
              />
            </div>
          </div>

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