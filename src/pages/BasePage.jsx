// src/pages/BasePage.js
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getRooms, getAllRoomStats } from '../services/roomService';
import { getAllMissions } from '../services/missionService';
import { getUserProfile, updateUserProfile } from '../services/userService';
import RoomCard from '../components/base/RoomCard';
import AddRoomModal from '../components/base/AddRoomModal';
import ErrorMessage from '../components/ui/ErrorMessage';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../utils/fetchWithTimeout';
import './BasePage.css';

const BasePage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [roomStats, setRoomStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [baseName, setBaseName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [saveNameError, setSaveNameError] = useState(null);
  const nameInputRef = useRef(null);

  const fetchRoomsAndStats = async () => {
    if (!currentUser) return;
    if (isDefinitelyOffline()) {
      setLoadError("Your rooms didn't load. Check your connection and try again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setIsLoadingSlow(false);
    const slowTimer = setTimeout(() => setIsLoadingSlow(true), 3000);
    try {
      const [missions, profile] = await withTimeout(
        Promise.all([
          getAllMissions(currentUser.uid),
          getUserProfile(currentUser.uid),
        ])
      );
      const roomsWithStats = await withTimeout(getAllRoomStats(currentUser.uid, missions));
      setRoomStats(roomsWithStats);
      setRooms(roomsWithStats);
      setBaseName(profile?.baseName || '');
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setLoadError(getLoadErrorMessage(error, 'rooms'));
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setIsLoadingSlow(false);
    }
  };

  useEffect(() => {
    fetchRoomsAndStats();
  }, [currentUser]);

  const handleRoomClick = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  const handleAddRoom = () => {
    setShowAddRoomModal(true);
  };

  const handleStartEditName = () => {
    setEditNameValue(baseName);
    setIsEditingName(true);
    setSaveNameError(null);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setSaveNameError(null);
  };

  const handleSaveName = async () => {
    const trimmed = editNameValue.trim();
    setSaveNameError(null);
    try {
      await updateUserProfile(currentUser.uid, { baseName: trimmed });
      setBaseName(trimmed);
      setIsEditingName(false);
    } catch (err) {
      console.error('Error saving base name:', err);
      setSaveNameError("That name didn't save. Try again.");
    }
  };

  const handleRoomAdded = async () => {
    setShowAddRoomModal(false);
    await fetchRoomsAndStats();
  };

  if (loading) {
    return (
      <div className="base-page-container">
        <div className="loading">
          Loading your base...
          {isLoadingSlow && <p className="loading-slow-hint">Your messenger raven is taking the scenic route...</p>}
        </div>
      </div>
    );
  }

  const hasCustomRooms = rooms.length > 1; // More than just "Entire Base"

  return (
    <div className="base-page-container">
      {/* Header */}
      <header className="base-page-header">
        <button className="back-button" onClick={() => navigate('/home')}>
          <span className="material-icons">arrow_back</span>
        </button>

        {isEditingName ? (
          <div className="base-name-edit">
            <input
              ref={nameInputRef}
              className="base-name-input"
              value={editNameValue}
              onChange={e => setEditNameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelEditName(); }}
              placeholder="Name your base..."
              maxLength={40}
            />
            <div className="base-name-edit-actions">
              {saveNameError && <span className="base-name-error">{saveNameError}</span>}
              <button className="base-name-cancel" onClick={handleCancelEditName}>Cancel</button>
              <button className="base-name-save" onClick={handleSaveName}>Save</button>
            </div>
          </div>
        ) : (
          <div className="base-title-row">
            <h1 className="page-title">{baseName || 'Your Base'}</h1>
            <button className="base-name-edit-btn" onClick={handleStartEditName} aria-label="Edit base name">
              <span className="material-icons">edit</span>
            </button>
          </div>
        )}

        <div className="header-spacer" />
      </header>

      {loadError && (
        <ErrorMessage
          message={loadError}
          onRetry={() => { setLoadError(null); fetchRoomsAndStats(); }}
          className="base-load-error"
        />
      )}

      {/* Rooms Grid */}
      <div className="rooms-grid">
        {roomStats.map((room) => (
          <RoomCard
            key={room.roomId}
            room={room}
            stats={room.stats}
            onClick={() => handleRoomClick(room.roomId)}
          />
        ))}

        {/* Add Room Card */}
        <div className="add-room-card" onClick={handleAddRoom}>
          <div className="add-room-icon">
            <span className="material-icons">add</span>
          </div>
          {!hasCustomRooms && (
            <div className="add-room-label">Add your first room</div>
          )}
        </div>
      </div>

      {/* Add Room Modal */}
      {showAddRoomModal && (
        <AddRoomModal
          onClose={() => setShowAddRoomModal(false)}
          onRoomAdded={handleRoomAdded}
        />
      )}
    </div>
  );
};

export default BasePage;