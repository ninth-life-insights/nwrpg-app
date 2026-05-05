// src/components/base/RoomDetailModal.jsx
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getRoom, updateRoomCleanliness, getRoomStats } from '../../services/roomService';
import { getAllMissions, completeMissionWithRecurrence, uncompleteMission } from '../../services/missionService';
import MissionCard from '../missions/MissionCard';
import AddMissionCard from '../missions/AddMissionCard';
import ErrorMessage from '../ui/ErrorMessage';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import { withTimeout } from '../../utils/fetchWithTimeout';
import './RoomDetailModal.css';

const CLEANLINESS_LABELS = { 1: 'Messy', 2: 'Needs Help', 3: 'Workable', 4: 'Clean', 5: 'Spotless' };
const CLEANLINESS_COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#84cc16', 5: '#10b981' };

const isImageIcon = (icon) => icon && icon.includes('.');

const RoomDetailModal = ({ roomId, onClose }) => {
  const { currentUser } = useAuth();
  const [room, setRoom] = useState(null);
  const [missions, setMissions] = useState([]);
  const [stats, setStats] = useState({ total: 0, dueThisWeek: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [showSlider, setShowSlider] = useState(false);
  const [localCleanliness, setLocalCleanliness] = useState(3);
  const [showAddMission, setShowAddMission] = useState(false);

  useModalBackButton(true, onClose);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setLoadError(null);
    setLoading(true);
    try {
      const [roomData, allMissions] = await withTimeout(
        Promise.all([
          getRoom(currentUser.uid, roomId),
          getAllMissions(currentUser.uid),
        ])
      );
      if (!roomData) {
        setLoadError("This room couldn't be found.");
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
    } catch (err) {
      console.error('Error fetching room data:', err);
      setLoadError("Your room didn't load. Try again.");
    } finally {
      setLoading(false);
    }
  }, [currentUser, roomId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCleanlinessChange = (e) => {
    setLocalCleanliness(parseInt(e.target.value));
  };

  const handleCleanlinessSave = async () => {
    if (!room || localCleanliness === room.cleanliness) return;
    setActionError(null);
    try {
      await updateRoomCleanliness(currentUser.uid, roomId, localCleanliness);
      setRoom(prev => ({ ...prev, cleanliness: localCleanliness }));
    } catch (err) {
      console.error('Error updating cleanliness:', err);
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
        await completeMissionWithRecurrence(currentUser.uid, missionId);
      }
      await fetchData();
    } catch (err) {
      console.error('Error toggling mission:', err);
      setActionError(isCurrentlyCompleted
        ? "That undo didn't go through. Try again."
        : "That mission didn't complete. Try again."
      );
    }
  };

  const handleMissionAdded = () => {
    setShowAddMission(false);
    fetchData();
  };

  const cleanlinessColor = CLEANLINESS_COLORS[localCleanliness];
  const cleanlinessLabel = CLEANLINESS_LABELS[localCleanliness];
  const cleanlinessPercent = (localCleanliness / 5) * 100;

  const activeMissions = missions.filter(m => m.status === 'active');
  const completedMissions = missions.filter(m => m.status === 'completed');

  const statLine = stats.total === 0
    ? 'No missions yet'
    : `${stats.total} mission${stats.total !== 1 ? 's' : ''}${stats.overdue > 0 ? ` · ${stats.overdue} late` : ''}`;

  const content = (
    <div className="rdm-overlay" onClick={onClose}>
      <div className="rdm-sheet" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="rdm-header">
          <h2 className="rdm-title">{room?.name ?? 'Room'}</h2>
          <button className="rdm-close-btn" onClick={onClose} aria-label="Close">
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="rdm-body">
          {loading && !loadError && (
            <p className="rdm-loading">Loading...</p>
          )}

          {loadError && (
            <ErrorMessage message={loadError} onRetry={fetchData} />
          )}

          {!loading && !loadError && room && (
            <>
              {/* Hero image */}
              {isImageIcon(room.icon) && (
                <img
                  src={`/assets/Rooms/${room.icon}`}
                  alt={room.name}
                  className="rdm-hero-img"
                />
              )}

              {/* Stats + cleanliness card */}
              <div className="rdm-stats-card">
                <div className="rdm-cleanliness">
                  <div className="rdm-cleanliness-row">
                    <div className="rdm-cleanliness-bar-wrap">
                      <div className="rdm-cleanliness-bar-track">
                        <div
                          className="rdm-cleanliness-bar-fill"
                          style={{ width: `${cleanlinessPercent}%`, backgroundColor: cleanlinessColor }}
                        />
                      </div>
                    </div>
                    <span className="rdm-cleanliness-label" style={{ color: cleanlinessColor }}>
                      {cleanlinessLabel}
                    </span>
                    <button
                      className="rdm-cleanliness-edit-btn"
                      onClick={() => setShowSlider(v => !v)}
                      aria-label="Adjust cleanliness"
                    >
                      <span className="material-icons">
                        {showSlider ? 'expand_less' : 'edit'}
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
                      className="rdm-cleanliness-slider"
                    />
                  )}
                </div>

                <p className="rdm-stat-line">{statLine}</p>

                {actionError && <ErrorMessage message={actionError} />}
              </div>

              {/* Missions */}
              <div className="rdm-missions">
                <div className="rdm-missions-header">
                  <h3 className="rdm-missions-title">Missions</h3>
                  <button
                    className="rdm-add-btn"
                    onClick={() => setShowAddMission(true)}
                  >
                    + Add
                  </button>
                </div>

                {activeMissions.length === 0 && completedMissions.length === 0 && (
                  <p className="rdm-empty">No missions for this room yet.</p>
                )}

                {activeMissions.map(mission => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    onToggleComplete={handleToggleComplete}
                    onMissionChanged={fetchData}
                    hideRoomBadge
                  />
                ))}

                {completedMissions.length > 0 && (
                  <>
                    <div className="rdm-completed-divider">
                      <span>Completed</span>
                    </div>
                    {completedMissions.map(mission => (
                      <MissionCard
                        key={mission.id}
                        mission={mission}
                        onToggleComplete={handleToggleComplete}
                        onMissionChanged={fetchData}
                        hideRoomBadge
                      />
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showAddMission && (
        <AddMissionCard
          onAddMission={handleMissionAdded}
          onCancel={() => setShowAddMission(false)}
          defaultRoomId={roomId}
        />
      )}
    </div>
  );

  return createPortal(content, document.body);
};

export default RoomDetailModal;
