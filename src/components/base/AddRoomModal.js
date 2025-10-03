// src/components/rooms/AddRoomModal.js
import React, { useState } from 'react';
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
  'stairs'
];

const AddRoomModal = ({ onClose, onRoomAdded }) => {
  const { currentUser } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('room');
  const [cleanliness, setCleanliness] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!roomName.trim()) {
      setError('Please enter a room name');
      return;
    }

    try {
      setSaving(true);
      setError('');
      
      await createRoom(currentUser.uid, {
        name: roomName.trim(),
        icon: selectedIcon,
        cleanliness: cleanliness
      });
      
      onRoomAdded();
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please try again.');
      setSaving(false);
    }
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
      <div className="modal-content add-room-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Room</h2>
          <button className="close-button" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-room-form">
          {/* Room Name */}
          <div className="form-section">
            <label className="form-label">Room Name</label>
            <input
              type="text"
              className="text-input"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g., Kitchen, Master Bedroom"
              autoFocus
            />
          </div>

          {/* Icon Picker */}
          <div className="form-section">
            <label className="form-label">Choose an Icon</label>
            <div className="icon-grid">
              {ROOM_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`icon-option ${selectedIcon === icon ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(icon)}
                >
                  <span className="material-icons">{icon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cleanliness Slider */}
          <div className="form-section">
            <label className="form-label">
              Current Cleanliness: {cleanliness}/5
            </label>
            <div className="slider-container">
              <input
                type="range"
                min="1"
                max="5"
                value={cleanliness}
                onChange={(e) => setCleanliness(parseInt(e.target.value))}
                className="cleanliness-slider"
                style={{
                  '--slider-color': getCleanlinessColor(cleanliness)
                }}
              />
              <div className="slider-labels">
                <span>Needs Work</span>
                <span>Spotless</span>
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          {/* Action Buttons */}
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
            >
              {saving ? 'Adding...' : 'Add Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRoomModal;