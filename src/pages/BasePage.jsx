// src/pages/BasePage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAllRoomStats, initializeEntireBaseRoom, ENTIRE_BASE_ROOM_ID } from '../services/roomService';
import { getAllMissions } from '../services/missionService';
import { getUserProfile } from '../services/userService';
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
  const [showBaseIconModal, setShowBaseIconModal] = useState(false);
  const [baseName, setBaseName] = useState('');

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
      await initializeEntireBaseRoom(currentUser.uid);
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
    console.log('[BasePage] handleAddRoom clicked. history.length:', history.length, 'state:', JSON.stringify(history.state), 'url:', location.href);
    setShowAddRoomModal(true);
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

  const entireBaseRoom = rooms.find(r => r.id === ENTIRE_BASE_ROOM_ID);
  const baseIconUnset = !entireBaseRoom || entireBaseRoom.icon === 'home';

  const otherRooms = roomStats.filter(r => r.id !== ENTIRE_BASE_ROOM_ID);
  const avgCleanliness = otherRooms.length > 0
    ? Math.round(otherRooms.reduce((sum, r) => sum + (r.cleanliness || 3), 0) / otherRooms.length)
    : 3;

  return (
    <div className="base-page-container">
      {/* Header */}
      <header className="base-page-header">
        <button className="base-page-back-btn" onClick={() => navigate('/home')}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="base-page-title">Your Base</h1>
        <div className="base-page-header-spacer" />
      </header>

      {loadError && (
        <ErrorMessage
          message={loadError}
          onRetry={() => { setLoadError(null); fetchRoomsAndStats(); }}
          className="base-load-error"
        />
      )}

      {/* First-time base setup banner */}
      {baseIconUnset && (
        <div className="base-setup-banner">
          <p className="base-setup-banner-text">Give your base a look — set a name and choose an icon.</p>
          <button className="base-setup-banner-btn" onClick={() => setShowBaseIconModal(true)}>
            Get started →
          </button>
        </div>
      )}

      {/* Rooms Grid */}
      <div className="rooms-grid">
        {roomStats.map((room) => {
          const isEntireBase = room.id === ENTIRE_BASE_ROOM_ID || room.roomId === ENTIRE_BASE_ROOM_ID;
          const displayRoom = isEntireBase
            ? { ...room, name: baseName || room.name, cleanliness: avgCleanliness }
            : room;

          return (
            <div key={room.roomId} className="room-card-slot">
              <RoomCard
                room={displayRoom}
                stats={room.stats}
                onClick={() => handleRoomClick(room.roomId || room.id)}
              />
              {isEntireBase && baseIconUnset && (
                <button className="base-look-btn" onClick={() => setShowBaseIconModal(true)}>
                  <span className="material-icons">photo</span>
                  Choose base look
                </button>
              )}
            </div>
          );
        })}

        {/* Add Room Card */}
        <div className="room-card-slot">
          <div className="add-room-card" onClick={handleAddRoom}>
            <div className="add-room-icon">
              <span className="material-icons">add</span>
            </div>
            {!hasCustomRooms && (
              <div className="add-room-label">Add your first room</div>
            )}
          </div>
        </div>
      </div>

      {/* Add Room Modal */}
      {showAddRoomModal && (
        <AddRoomModal
          onClose={() => setShowAddRoomModal(false)}
          onRoomAdded={handleRoomAdded}
        />
      )}

      {/* Base icon + nickname setup modal */}
      {showBaseIconModal && entireBaseRoom && (
        <AddRoomModal
          onClose={() => setShowBaseIconModal(false)}
          onRoomAdded={() => { setShowBaseIconModal(false); fetchRoomsAndStats(); }}
          editRoom={entireBaseRoom}
          isBaseRoom={true}
          baseName={baseName}
        />
      )}
    </div>
  );
};

export default BasePage;