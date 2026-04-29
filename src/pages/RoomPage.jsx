// src/pages/RoomPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRoom, updateRoom, updateRoomCleanliness, deleteRoom, getRoomStats } from '../services/roomService';
import { getAllMissions, completeMissionWithRecurrence, uncompleteMission, deleteMission } from '../services/missionService';
import MissionCard from '../components/missions/MissionCard';
import MissionDetailView from '../components/missions/MissionCardFull';
import AddMissionCard from '../components/missions/AddMissionCard';
import AddRoomModal from '../components/base/AddRoomModal';
import ErrorMessage from '../components/ui/ErrorMessage';
import AchievementToast from '../components/achievements/AchievementToast';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../utils/fetchWithTimeout';
import './RoomPage.css';

const CLEANLINESS_LABELS = { 1: 'Messy', 2: 'Needs Help', 3: 'Workable', 4: 'Clean', 5: 'Spotless' };
const CLEANLINESS_COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#84cc16', 5: '#10b981' };

const isImageIcon = (icon) => icon && icon.includes('.');

const RoomPage = () => {
  const { roomId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [missions, setMissions] = useState([]);
  const [stats, setStats] = useState({ total: 0, dueThisWeek: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Three-dot menu
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // Inline cleanliness editing
  const [showSlider, setShowSlider] = useState(false);
  const [localCleanliness, setLocalCleanliness] = useState(3);

  // Modals
  const [selectedMission, setSelectedMission] = useState(null);
  const [showAddMission, setShowAddMission] = useState(false);
  const [showEditRoom, setShowEditRoom] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newAchievements, setNewAchievements] = useState([]);

  // Click-outside to close three-dot menu
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowDeleteConfirm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMenu]);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    if (isDefinitelyOffline()) {
      setLoadError("Your room didn't load. Check your connection and try again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setIsLoadingSlow(false);
    const slowTimer = setTimeout(() => setIsLoadingSlow(true), 3000);
    try {
      const [roomData, allMissions] = await withTimeout(
        Promise.all([
          getRoom(currentUser.uid, roomId),
          getAllMissions(currentUser.uid),
        ])
      );

      if (!roomData) {
        setLoadError("This room doesn't exist.");
        return;
      }

      const roomMissions = allMissions.filter(
        m => m.baseLocation === roomId && m.status !== 'deleted'
      );
      const roomStats = await getRoomStats(roomId, allMissions);

      setRoom(roomData);
      setLocalCleanliness(roomData.cleanliness || 3);
      setMissions(roomMissions);
      setStats(roomStats);
    } catch (error) {
      console.error('Error fetching room data:', error);
      setLoadError(getLoadErrorMessage(error, 'room'));
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setIsLoadingSlow(false);
    }
  }, [currentUser, roomId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCleanlinessChange = (e) => {
    setLocalCleanliness(parseInt(e.target.value));
  };

  const handleCleanlinessSave = async () => {
    if (localCleanliness === room.cleanliness) return;
    setActionError(null);
    try {
      await updateRoomCleanliness(currentUser.uid, roomId, localCleanliness);
      setRoom(prev => ({ ...prev, cleanliness: localCleanliness }));
    } catch (error) {
      console.error('Error updating cleanliness:', error);
      setActionError("That cleanliness update didn't save. Try again.");
      setLocalCleanliness(room.cleanliness);
    }
  };

  const handleToggleComplete = async (missionId, isCurrentlyCompleted) => {
    setActionError(null);
    try {
      if (isCurrentlyCompleted) {
        await uncompleteMission(currentUser.uid, missionId);
      } else {
        const result = await completeMissionWithRecurrence(currentUser.uid, missionId);
        if (result?.newlyAwardedAchievements?.length > 0) {
          setNewAchievements(result.newlyAwardedAchievements);
        }
      }
      await fetchData();
      setSelectedMission(null);
    } catch (error) {
      console.error('Error toggling mission:', error);
      setActionError(isCurrentlyCompleted
        ? "That undo didn't go through. Try again."
        : "That mission didn't complete. Try again."
      );
    }
  };

  const handleDeleteMission = async (missionId) => {
    setActionError(null);
    try {
      await deleteMission(currentUser.uid, missionId);
      setSelectedMission(null);
      await fetchData();
    } catch (error) {
      console.error('Error deleting mission:', error);
      setActionError("That mission didn't delete. Try again.");
    }
  };

  const handleUpdateMission = (updatedMission) => {
    setMissions(prev => prev.map(m => m.id === updatedMission.id ? updatedMission : m));
    if (selectedMission?.id === updatedMission.id) setSelectedMission(updatedMission);
  };

  const handleMissionAdded = async () => {
    setShowAddMission(false);
    await fetchData();
  };

  const handleRoomUpdated = async () => {
    setShowEditRoom(false);
    await fetchData();
  };

  const handleDeleteRoom = async () => {
    setActionError(null);
    try {
      await deleteRoom(currentUser.uid, roomId);
      navigate('/base');
    } catch (error) {
      console.error('Error deleting room:', error);
      setActionError("That room didn't delete. Try again.");
      setShowMenu(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="room-page">
        <div className="loading">
          Loading your room...
          {isLoadingSlow && <p className="loading-slow-hint">The scouts are still searching...</p>}
        </div>
      </div>
    );
  }

  if (loadError || !room) {
    return (
      <div className="room-page">
        <header className="room-page-header">
          <button className="room-page-back-btn" onClick={() => navigate('/base')}>
            <span className="material-icons">arrow_back</span>
          </button>
          <h1 className="room-page-title">Room</h1>
          <div className="room-page-header-spacer" />
        </header>
        <ErrorMessage
          message={loadError || "This room doesn't exist."}
          onRetry={() => { setLoadError(null); fetchData(); }}
        />
      </div>
    );
  }

  const activeMissions = missions.filter(m => m.status === 'active');
  const completedMissions = missions.filter(m => m.status === 'completed');
  const cleanlinessColor = CLEANLINESS_COLORS[localCleanliness];
  const cleanlinessLabel = CLEANLINESS_LABELS[localCleanliness];
  const cleanlinessPercent = (localCleanliness / 5) * 100;

  const statLine = stats.total === 0
    ? 'No missions yet'
    : `${stats.total} mission${stats.total !== 1 ? 's' : ''}${stats.overdue > 0 ? ` · ${stats.overdue} late` : ''}`;

  return (
    <div className="room-page">

      {/* Header */}
      <header className="room-page-header">
        <button className="room-page-back-btn" onClick={() => navigate('/base')}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="room-page-title">{room.name}</h1>

        {room.canDelete ? (
          <div className="room-page-menu-wrap" ref={menuRef}>
            <button
              className="room-page-menu-btn"
              onClick={() => { setShowMenu(v => !v); setShowDeleteConfirm(false); }}
              aria-label="More options"
            >
              <span className="material-icons">more_vert</span>
            </button>
            {showMenu && (
              <div className="room-page-dropdown">
                {!showDeleteConfirm ? (
                  <>
                    <button
                      className="room-page-dropdown-item"
                      onClick={() => { setShowMenu(false); setShowEditRoom(true); }}
                    >
                      <span className="material-icons">edit</span>
                      Edit Room
                    </button>
                    <button
                      className="room-page-dropdown-item room-page-dropdown-item--delete"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <span className="material-icons">delete</span>
                      Delete Room
                    </button>
                  </>
                ) : (
                  <div className="room-page-delete-confirm">
                    <p className="room-page-delete-confirm-text">Delete this room?</p>
                    <div className="room-page-delete-confirm-actions">
                      <button
                        className="room-page-confirm-cancel"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="room-page-confirm-delete"
                        onClick={handleDeleteRoom}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="room-page-header-spacer" />
        )}
      </header>

      {/* Stats + Cleanliness card */}
      <div className="room-page-stats-card">
        {isImageIcon(room.icon) && (
          <img
            src={`/assets/Rooms/${room.icon}`}
            alt={room.name}
            className="room-page-hero-img"
          />
        )}

        <div className="room-page-cleanliness">
          <div className="room-page-cleanliness-row">
            <div className="room-page-cleanliness-bar-wrap">
              <div className="room-page-cleanliness-bar-track">
                <div
                  className="room-page-cleanliness-bar-fill"
                  style={{ width: `${cleanlinessPercent}%`, backgroundColor: cleanlinessColor }}
                />
              </div>
            </div>
            <span className="room-page-cleanliness-label" style={{ color: cleanlinessColor }}>
              {cleanlinessLabel}
            </span>
            <button
              className="room-page-cleanliness-edit-btn"
              onClick={() => setShowSlider(v => !v)}
              aria-label="Adjust cleanliness"
            >
              <span className="material-icons">
                {showSlider ? 'expand_less' : 'tune'}
              </span>
            </button>
          </div>

          {showSlider && (
            <input
              type="range"
              min="1"
              max="5"
              value={localCleanliness}
              onChange={handleCleanlinessChange}
              onMouseUp={handleCleanlinessSave}
              onTouchEnd={handleCleanlinessSave}
              className="room-page-cleanliness-slider"
            />
          )}
        </div>

        <p className="room-page-stat-line">{statLine}</p>

        {actionError && <ErrorMessage message={actionError} />}
      </div>

      {/* Missions section */}
      <div className="room-page-missions">
        <div className="room-page-missions-header">
          <h2 className="room-page-missions-title">Missions</h2>
          <button
            className="room-page-add-btn"
            onClick={() => setShowAddMission(true)}
          >
            + Add
          </button>
        </div>

        {activeMissions.length === 0 && completedMissions.length === 0 && (
          <p className="room-page-empty">No missions for this room yet.</p>
        )}

        {activeMissions.map(mission => (
          <MissionCard
            key={mission.id}
            mission={mission}
            onToggleComplete={handleToggleComplete}
            onViewDetails={setSelectedMission}
          />
        ))}

        {completedMissions.length > 0 && (
          <>
            <div className="room-page-completed-divider">
              <span>Completed</span>
            </div>
            {completedMissions.map(mission => (
              <MissionCard
                key={mission.id}
                mission={mission}
                onToggleComplete={handleToggleComplete}
                onViewDetails={setSelectedMission}
              />
            ))}
          </>
        )}
      </div>

      {/* Add Mission modal */}
      {showAddMission && (
        <AddMissionCard
          onAddMission={handleMissionAdded}
          onCancel={() => setShowAddMission(false)}
          defaultRoomId={roomId}
        />
      )}

      {/* Edit Room modal */}
      {showEditRoom && (
        <AddRoomModal
          onClose={() => setShowEditRoom(false)}
          onRoomAdded={handleRoomUpdated}
          editRoom={room}
        />
      )}

      {/* Mission detail modal */}
      {selectedMission && (
        <MissionDetailView
          mission={selectedMission}
          onClose={() => setSelectedMission(null)}
          onToggleComplete={handleToggleComplete}
          onDeleteMission={handleDeleteMission}
          onUpdateMission={handleUpdateMission}
        />
      )}

      <AchievementToast
        achievements={newAchievements}
        onDismiss={() => setNewAchievements([])}
      />
    </div>
  );
};

export default RoomPage;
