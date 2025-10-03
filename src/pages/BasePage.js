// src/pages/BasePage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getRooms, getAllRoomStats } from '../services/roomService';
import { getAllMissions } from '../services/missionService';
import RoomCard from '../components/base/RoomCard';
import AddRoomModal from '../components/base/AddRoomModal';
import './BasePage.css';

const BasePage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [roomStats, setRoomStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);

  const fetchRoomsAndStats = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      
      // Get all missions for stats calculation
      const missions = await getAllMissions(currentUser.uid);
      
      // Get rooms with stats
      const roomsWithStats = await getAllRoomStats(currentUser.uid, missions);
      
      setRoomStats(roomsWithStats);
      setRooms(roomsWithStats);
      
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
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

  const handleRoomAdded = async () => {
    setShowAddRoomModal(false);
    await fetchRoomsAndStats();
  };

  if (loading) {
    return (
      <div className="base-page-container">
        <div className="loading">Loading your base...</div>
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
        <h1 className="page-title">Your Base</h1>
        <div className="header-spacer" />
      </header>

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