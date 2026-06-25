// src/components/base/AddRoomModal.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRooms } from '../../contexts/RoomsContext';
import { createRoom, updateRoom } from '../../services/roomService';
import { updateUserProfile } from '../../services/userService';
import ErrorMessage from '../ui/ErrorMessage';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import './AddRoomModal.css';

const ROOM_ICONS = [
  { value: 'Room-bed.jpg',      label: 'Bedroom' },
  { value: 'Room-sleep.png',    label: 'Sleep' },
  { value: 'Room-kitchen.png',  label: 'Kitchen' },
  { value: 'Room-cook.png',     label: 'Cooking' },
  { value: 'Room-dining.jpg',   label: 'Dining Room' },
  { value: 'Room-couch.jpg',    label: 'Living Room' },
  { value: 'Room-TV.jpg',       label: 'TV Room' },
  { value: 'Room-Shower.jpg',   label: 'Bathroom' },
  { value: 'Room-bath.png',     label: 'Bath' },
  { value: 'Room-toilet.jpg',   label: 'Toilet' },
  { value: 'Room-laundry.png',  label: 'Laundry' },
  { value: 'Room-crib.png',     label: 'Nursery' },
  { value: 'Room-toys.png',     label: 'Playroom' },
  { value: 'Room-books.png',    label: 'Study' },
  { value: 'Room-craft.jpg',    label: 'Craft Room' },
  { value: 'Room-drink.png',    label: 'Bar' },
  { value: 'Room-garage.png',   label: 'Garage' },
  { value: 'Room-car.png',      label: 'Car' },
  { value: 'Room-outdoors.png', label: 'Outdoors' },
  { value: 'Room-storage.png',  label: 'Storage' },
  { value: 'Room-entry.jpg',    label: 'Entryway' },
];

const BASE_ICONS = [
  { value: 'Room-base-cabin.png',     label: 'Cabin' },
  { value: 'Room-base-castle.png',    label: 'Castle' },
  { value: 'Room-base-treehouse.png', label: 'Treehouse' },
  { value: 'Room-base-hobbit.png',    label: 'Hobbit Hole' },
  { value: 'Room-base-tower.png',     label: 'Tower' },
  { value: 'Room-base-baba-yaga.png', label: "Baba Yaga's Hut" },
];

const CLEANLINESS_LABELS = { 1: 'Messy', 2: 'Needs Help', 3: 'Holding Steady', 4: 'Clean', 5: 'Spotless' };
const CLEANLINESS_COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#84cc16', 5: '#10b981' };

const AddRoomModal = ({ onClose, onRoomAdded, editRoom = null, isBaseRoom = false, baseName = '' }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { refreshRooms } = useRooms();
  const isEditing = !!editRoom;
  const isFirstTimeBase = isBaseRoom && (!editRoom?.icon || editRoom?.icon === 'home');

  const [roomName, setRoomName] = useState(
    isBaseRoom ? baseName : (editRoom?.name || '')
  );
  const [selectedIcon, setSelectedIcon] = useState(
    isBaseRoom
      ? (isFirstTimeBase ? null : (editRoom?.icon || null))
      : (editRoom?.icon || ROOM_ICONS[0].value)
  );
  const [cleanliness, setCleanliness] = useState(editRoom?.cleanliness ?? 3);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  useModalBackButton(true, onClose);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async () => {
    if (!isBaseRoom && !roomName.trim()) return;
    if (isBaseRoom && !selectedIcon) return;
    setSaveError(null);
    setSaving(true);
    try {
      let newRoomId = null;
      if (isBaseRoom) {
        await updateRoom(currentUser.uid, editRoom.id, { icon: selectedIcon });
        await updateUserProfile(currentUser.uid, { baseName: roomName.trim() });
      } else if (isEditing) {
        await updateRoom(currentUser.uid, editRoom.id, {
          name: roomName.trim(),
          icon: selectedIcon,
          cleanliness,
        });
      } else {
        newRoomId = await createRoom(currentUser.uid, {
          name: roomName.trim(),
          icon: selectedIcon,
          cleanliness,
        });
      }
      await refreshRooms();
      onRoomAdded();

      // After creating a brand new room (not editing, not base setup),
      // navigate to its page and signal the suggestion picker to open.
      // The picker is filtered by the icon the user chose.
      if (newRoomId && navigate) {
        navigate(`/room/${newRoomId}`, {
          state: { openSuggestions: true, roomIcon: selectedIcon },
        });
      }
    } catch (err) {
      console.error('Error saving room:', err);
      if (isBaseRoom) {
        setSaveError("Your base didn't save. Try again.");
      } else {
        setSaveError(isEditing ? "That room didn't update. Try again." : "That room didn't save. Try again.");
      }
      setSaving(false);
    }
  };

  const iconList = isBaseRoom ? BASE_ICONS : ROOM_ICONS;

  const title = isBaseRoom
    ? (isFirstTimeBase ? 'Set Up Your Base' : 'Edit Base')
    : (isEditing ? 'Edit Room' : 'Add a Room');

  const saveLabel = isBaseRoom ? 'Save' : (isEditing ? 'Save Changes' : 'Add Room');
  const savingLabel = isBaseRoom ? 'Saving...' : (isEditing ? 'Saving...' : 'Adding...');
  const isSaveDisabled = saving || (isBaseRoom ? !selectedIcon : !roomName.trim());

  return (
    <div className="add-room-overlay" onClick={handleBackdropClick}>
      <div className="add-room-modal">

        {/* Header */}
        <div className="add-room-header">
          <h2 className="add-room-title">{title}</h2>
          <button className="add-room-close" onClick={onClose} aria-label="Close">
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="add-room-body">

          {/* Name / Nickname */}
          <div className="add-room-field">
            <label className="add-room-label" htmlFor="room-name">
              {isBaseRoom ? 'Nickname' : <>Name <span className="add-room-required">*</span></>}
            </label>
            <input
              id="room-name"
              className="add-room-input"
              type="text"
              placeholder={isBaseRoom ? 'e.g. The Cozy Den' : 'e.g. Kitchen'}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={40}
            />
          </div>

          {/* Icon picker */}
          <div className="add-room-field">
            <label className="add-room-label">
              {isBaseRoom ? <>Icon <span className="add-room-required">*</span></> : 'Icon'}
            </label>
            <div className="room-icon-scroll">
              {iconList.map(({ value, label }) => (
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

          {/* Cleanliness — hidden for base room (auto-computed) */}
          {!isBaseRoom && (
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
          )}

          {saveError && <ErrorMessage message={saveError} />}
        </div>

        {/* Footer */}
        <div className="add-room-footer">
          <button className="add-room-cancel" onClick={onClose}>Cancel</button>
          <button
            className="add-room-save"
            onClick={handleSubmit}
            disabled={isSaveDisabled}
          >
            {saving ? savingLabel : saveLabel}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddRoomModal;
