// src/components/base/RoomDetailModal.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getRoom, ENTIRE_BASE_ROOM_ID } from '../../services/roomService';
import { useMissionCompletion } from '../../contexts/MissionCompletionContext';
import { useMissions } from '../../contexts/MissionsContext';
import { getUserProfile } from '../../services/userService';
import MissionCard from '../missions/MissionCard';
import AddMissionCard from '../missions/AddMissionCard';
import ErrorMessage from '../ui/ErrorMessage';
import { withTimeout } from '../../utils/fetchWithTimeout';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import './RoomDetailModal.css';

const RoomDetailModal = ({ roomId, onClose }) => {
  const { currentUser } = useAuth();
  useModalBackButton(true, onClose);
  const {
    completeMission: completeMissionOptimistic,
    uncompleteMission: uncompleteMissionOptimistic,
  } = useMissionCompletion();
  const {
    missions: allMissions,
    isInitialLoading: missionsCacheLoading,
    refresh: refreshMissionsCache,
  } = useMissions();
  const [room, setRoom] = useState(null);
  const [roomTitle, setRoomTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [showAddMission, setShowAddMission] = useState(false);

  // Room-scoped mission list derived synchronously from the cache.
  const missions = useMemo(() => {
    if (allMissions == null) return [];
    return allMissions.filter(
      m => m.baseLocation === roomId && m.status !== 'deleted'
    );
  }, [allMissions, roomId]);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setLoadError(null);
    setLoading(true);
    try {
      const [roomData, profile] = await withTimeout(
        Promise.all([
          getRoom(currentUser.uid, roomId),
          getUserProfile(currentUser.uid),
        ])
      );
      if (!roomData) {
        setLoadError("This room couldn't be found.");
        return;
      }
      setRoom(roomData);
      setRoomTitle(
        roomId === ENTIRE_BASE_ROOM_ID
          ? (profile?.baseName || roomData.name)
          : roomData.name
      );
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

    if (isCurrentlyCompleted) {
      uncompleteMissionOptimistic(missionId, {
        onError: () => {
          setActionError("That undo didn't go through. Try again.");
        },
      });
      return;
    }

    const mission = missions.find((m) => m.id === missionId);
    // MissionCompletionContext mutates the shared cache directly; the local
    // memo above re-derives the room view on the same tick.
    completeMissionOptimistic(missionId, mission, {
      onError: () => {
        setActionError("That mission didn't complete. Try again.");
      },
    });
  };

  const handleMissionAdded = () => {
    setShowAddMission(false);
    refreshMissionsCache();
  };

  const handleMissionChanged = () => {
    refreshMissionsCache();
  };

  const activeMissions = missions.filter(m => m.status === 'active');
  // Combine room-metadata loading with cache-not-yet-ready so the empty
  // state can't flash while either is still in flight.
  const isInitialLoad = loading || missionsCacheLoading;

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
          {isInitialLoad && !loadError && (
            <p className="rdm-loading">Loading...</p>
          )}

          {loadError && (
            <ErrorMessage message={loadError} onRetry={fetchData} />
          )}

          {!isInitialLoad && !loadError && (
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
                  onMissionChanged={handleMissionChanged}
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
