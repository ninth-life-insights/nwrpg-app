// src/components/base/RoomDetailModal.jsx
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getRoom, ENTIRE_BASE_ROOM_ID } from '../../services/roomService';
import { getAllMissions, completeMissionWithRecurrence, uncompleteMission } from '../../services/missionService';
import { getUserProfile } from '../../services/userService';
import MissionCard from '../missions/MissionCard';
import AddMissionCard from '../missions/AddMissionCard';
import ErrorMessage from '../ui/ErrorMessage';
import { withTimeout } from '../../utils/fetchWithTimeout';
import './RoomDetailModal.css';

const RoomDetailModal = ({ roomId, onClose }) => {
  const { currentUser } = useAuth();
  const [room, setRoom] = useState(null);
  const [roomTitle, setRoomTitle] = useState('');
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [showAddMission, setShowAddMission] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setLoadError(null);
    setLoading(true);
    try {
      const [roomData, allMissions, profile] = await withTimeout(
        Promise.all([
          getRoom(currentUser.uid, roomId),
          getAllMissions(currentUser.uid),
          getUserProfile(currentUser.uid),
        ])
      );
      if (!roomData) {
        setLoadError("This room couldn't be found.");
        return;
      }
      const roomMissions = allMissions.filter(
        m => m.baseLocation === roomId && m.status !== 'deleted'
      );
      setRoom(roomData);
      setRoomTitle(
        roomId === ENTIRE_BASE_ROOM_ID
          ? (profile?.baseName || roomData.name)
          : roomData.name
      );
      setMissions(roomMissions);
    } catch (err) {
      console.error('Error fetching room data:', err);
      setLoadError("Your room didn't load. Try again.");
    } finally {
      setLoading(false);
    }
  }, [currentUser, roomId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const activeMissions = missions.filter(m => m.status === 'active');

  const content = (
    <div className="rdm-overlay" onClick={onClose}>
      <div className="rdm-sheet" onClick={e => e.stopPropagation()}>

        {/* Sticky header */}
        <div className="rdm-header">
          <h2 className="rdm-title">{roomTitle || room?.name || 'Room'}</h2>
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

          {!loading && !loadError && (
            <>
              {actionError && (
                <div className="rdm-action-error-wrap">
                  <ErrorMessage message={actionError} />
                </div>
              )}

              {activeMissions.length === 0 && (
                <p className="rdm-empty">No active missions for this room.</p>
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
            </>
          )}
        </div>

        {/* Sticky footer — primary action */}
        <div className="rdm-footer">
          <button
            className="rdm-add-btn"
            onClick={() => setShowAddMission(true)}
          >
            + Add Mission
          </button>
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
