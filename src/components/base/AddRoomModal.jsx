// src/components/base/AddRoomModal.jsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRooms } from '../../contexts/RoomsContext';
import { createRoom, updateRoom } from '../../services/roomService';
import ErrorMessage from '../ui/ErrorMessage';
import './AddRoomModal.css';

const ROOM_ICONS = [
  { value: 'Room-bed.jpg',    label: 'Bedroom' },
  { value: 'Room-couch.jpg',  label: 'Living Room' },
  { value: 'Room-TV.jpg',     label: 'TV Room' },
  { value: 'Room-dining.jpg', label: 'Dining Room' },
  { value: 'Room-Shower.jpg', label: 'Bathroom' },
  { value: 'Room-toilet.jpg', label: 'Toilet' },
  { value: 'Room-craft.jpg',  label: 'Craft Room' },
  { value: 'Room-entry.jpg',  label: 'Entryway' },
];

const CLEANLINESS_LABELS = { 1: 'Messy', 2: 'Needs help', 3: 'Workable', 4: 'Clean', 5: 'Spotless' };
const CLEANLINESS_COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#84cc16', 5: '#10b981' };

const AddRoomModal = ({ onClose, onRoomAdded, editRoom = null }) => {
  const { currentUser } = useAuth();
  const { refreshRooms } = useRooms();
  const isEditing = !!editRoom;

  const [roomName, setRoomName] = useState(editRoom?.name || '');
  const [selectedIcon, setSelectedIcon] = useState(editRoom?.icon || ROOM_ICONS[0].value);
  const [cleanliness, setCleanliness] = useState(editRoom?.cleanliness ?? 3);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async () => {
    if (!roomName.trim()) return;
    setSaveError(null);
    setSaving(true);
    try {
      if (isEditing) {
        await updateRoom(currentUser.uid, editRoom.id, {
          name: roomName.trim(),
          icon: selectedIcon,
          cleanliness,
        });
      } else {
        await createRoom(currentUser.uid, {
          name: roomName.trim(),
          icon: selectedIcon,
          cleanliness,
        });
      }
      await refreshRooms();
      onRoomAdded();
    } catch (err) {
      console.error('Error saving room:', err);
      setSaveError(isEditing ? "That room didn't update. Try again." : "That room didn't save. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="add-room-overlay" onClick={handleBackdropClick}>
      <div className="add-room-modal">

        {/* Header */}
        <div className="add-room-header">
          <h2 className="add-room-title">{isEditing ? 'Edit Room' : 'Add a Room'}</h2>
          <button className="add-room-close" onClick={onClose} aria-label="Close">
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="add-room-body">

          {/* Name */}
          <div className="add-room-field">
            <label className="add-room-label" htmlFor="room-name">Name <span className="add-room-required">*</span></label>
            <input
              id="room-name"
              className="add-room-input"
              type="text"
              placeholder="e.g. Kitchen"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={40}
              autoFocus
            />
          </div>

          {/* Icon picker */}
          <div className="add-room-field">
            <label className="add-room-label">Icon</label>
            <div className="room-icon-scroll">
              {ROOM_ICONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`room-icon-btn${selectedIcon === value ? ' selected' : ''}`}
                  onClick={() => setSelectedIcon(value)}
                  aria-label={label}
                >
                  <img
                    src={`/assets/Rooms/${value}`}
                    alt={label}
                    className="room-icon-img"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Cleanliness */}
          <div className="add-room-field">
            <label className="add-room-label">
              Cleanliness —{' '}
              <span style={{ color: CLEANLINESS_COLORS[cleanliness] }}>
                {CLEANLINESS_LABELS[cleanliness]}
              </span>
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={cleanliness}
              onChange={(e) => setCleanliness(parseInt(e.target.value))}
              className="add-room-slider"
            />
          </div>

          {saveError && <ErrorMessage message={saveError} />}
        </div>

        {/* Footer */}
        <div className="add-room-footer">
          <button className="add-room-cancel" onClick={onClose}>Cancel</button>
          <button
            className="add-room-save"
            onClick={handleSubmit}
            disabled={saving || !roomName.trim()}
          >
            {saving ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Room')}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddRoomModal;
