// src/pages/RoomPage.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getRoom, updateRoom, updateRoomCleanliness, confirmRoomCleanliness, deleteRoom, getRoomStats, ENTIRE_BASE_ROOM_ID } from '../../services/roomService';
import { getUserProfile } from '../../services/userService';
import { useRooms } from '../../contexts/RoomsContext';
import { uncompleteMission } from '../../services/missionService';
import { useMissions } from '../../contexts/MissionsContext';
import { useMissionCompletion } from '../../contexts/MissionCompletionContext';
import LoadingTransition from '../../components/ui/LoadingTransition';
import RoomPageSkeleton from './RoomPageSkeleton';
import MissionCard from '../../components/missions/MissionCard';
import AddMissionCard from '../../components/missions/AddMissionCard';
import AddRoomModal from '../../components/base/AddRoomModal';
import QuickAddRoutineSheet from '../../components/routines/QuickAddRoutineSheet';
import MissionCardCondensed from '../../components/missions/MissionCardCondensed';
import { useRoutines } from '../../contexts/RoutineContext';
import { isMissionInRoutineSet, groupRoutineMissionsByFrequency } from '../../utils/routineHelpers';
import { DEFAULT_ROUTINE_ID } from '../../types/Routine';
import { RECURRENCE_PATTERNS } from '../../utils/recurrenceHelpers';
// Borrow the builder's bucket styling so the routine view here reads as
// a sibling of the main builder — same label weight, same count pill,
// same vertical rhythm.
import '../../components/routines/RoutineBuilderSection.css';

// Bucket labels for the room-scoped routine view. Mirrors the builder's
// frequency model so the cadence shape reads consistently across surfaces.
const ROUTINE_BUCKETS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];
import ErrorMessage from '../../components/ui/ErrorMessage';
import AchievementToast from '../../components/achievements/AchievementToast';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
import {
  isCleanlinessStale,
  getCleanlinessStaleLabel,
  buildCleanlinessSegments,
  CLEANLINESS_STALE_COLOR,
} from '../../utils/cleanlinessHelpers';
import CleanlinessSegmentedBar from '../../components/base/CleanlinessSegmentedBar';
import { useAndroidBackButton } from '../../hooks/useAndroidBackButton';
import './RoomPage.css';

const CLEANLINESS_LABELS = { 1: 'Messy', 2: 'Needs Help', 3: 'Holding Steady', 4: 'Clean', 5: 'Spotless' };
const CLEANLINESS_COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#84cc16', 5: '#10b981' };

const isImageIcon = (icon) => icon && icon.includes('.');

const RoomPage = () => {
  const { roomId } = useParams();
  const { currentUser } = useAuth();
  const { completeMission: completeMissionOptimistic } = useMissionCompletion();
  const { rooms: allRooms, refreshRooms } = useRooms();
  const navigate = useNavigate();

  const {
    missions: allMissions,
    isInitialLoading: missionsCacheLoading,
    refresh: refreshMissionsCache,
  } = useMissions();
  const [room, setRoom] = useState(null);
  const [baseName, setBaseName] = useState('');
  const [stats, setStats] = useState({ total: 0, dueThisWeek: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);

  // Room-scoped mission list derived synchronously from the shared cache.
  // Filtering happens inline (no async config read) so a re-render after the
  // cache updates lands on the new data the same tick, no flash.
  const missions = useMemo(() => {
    if (allMissions == null) return [];
    return allMissions.filter(m =>
      m.status !== 'deleted' &&
      (roomId === ENTIRE_BASE_ROOM_ID ? !!m.baseLocation : m.baseLocation === roomId)
    );
  }, [allMissions, roomId]);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [selectedRoomChip, setSelectedRoomChip] = useState('all');

  const isEntireBase = roomId === ENTIRE_BASE_ROOM_ID;

  // Three-dot menu
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // Inline cleanliness editing
  const [showSlider, setShowSlider] = useState(false);
  const [localCleanliness, setLocalCleanliness] = useState(3);

  // Modals
  const [showAddMission, setShowAddMission] = useState(false);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [showEditRoom, setShowEditRoom] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newAchievements, setNewAchievements] = useState([]);

  // Tab between "All" missions (default, the room's full task list) and
  // "Routine" (just routine-member missions whose baseLocation is this
  // room). The Routine tab makes the routine surface discoverable from
  // the top of the page rather than buried below the missions list.
  const [taskView, setTaskView] = useState('all');
  const { routineRootSet, cadenceByChainRoot, refreshRoutines } = useRoutines();

  const handleBack = () => navigate('/base');
  useAndroidBackButton(handleBack);

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
    try {
      const fetchList = [getRoom(currentUser.uid, roomId)];
      if (roomId === ENTIRE_BASE_ROOM_ID) {
        fetchList.push(getUserProfile(currentUser.uid));
      }
      const [roomData, profile] = await withTimeout(Promise.all(fetchList));

      if (!roomData) {
        setLoadError("This room doesn't exist.");
        return;
      }

      if (profile) setBaseName(profile.baseName || '');

      setRoom(roomData);
      setLocalCleanliness(roomData.cleanliness || 3);
    } catch (error) {
      console.error('Error fetching room data:', error);
      setLoadError(getLoadErrorMessage(error, 'room'));
    } finally {
      setLoading(false);
    }
  }, [currentUser, roomId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Room stats are derived from the shared cache so they update whenever a
  // completion / edit / delete elsewhere in the app mutates the cache.
  useEffect(() => {
    if (allMissions == null) return;
    let cancelled = false;
    getRoomStats(roomId, allMissions).then((next) => {
      if (!cancelled) setStats(next);
    }).catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, [allMissions, roomId]);

  const handleCleanlinessChange = (e) => {
    setLocalCleanliness(parseInt(e.target.value));
  };

  const handleCleanlinessSave = async () => {
    setActionError(null);
    try {
      // Any slider release counts as a check. If the value changed, save it;
      // otherwise just bump the freshness timestamp so a stale room can be
      // re-confirmed at the same level.
      if (localCleanliness !== room.cleanliness) {
        await updateRoomCleanliness(currentUser.uid, roomId, localCleanliness);
      } else {
        await confirmRoomCleanliness(currentUser.uid, roomId);
      }
      // Mirror the server-side timestamp bump locally so staleness state
      // updates immediately instead of waiting for a refetch.
      setRoom(prev => ({ ...prev, cleanliness: localCleanliness, cleanlinessUpdatedAt: new Date() }));
    } catch (error) {
      console.error('Error updating cleanliness:', error);
      setActionError("That cleanliness update didn't save. Try again.");
      setLocalCleanliness(room.cleanliness);
    }
  };

  const handleToggleComplete = async (missionId, isCurrentlyCompleted) => {
    setActionError(null);

    if (isCurrentlyCompleted) {
      try {
        await uncompleteMission(currentUser.uid, missionId);
        await fetchData();
      } catch (error) {
        console.error('Error uncompleting mission:', error);
        setActionError("That undo didn't go through. Try again.");
      }
      return;
    }

    const mission = missions.find((m) => m.id === missionId);
    // MissionCompletionContext mutates the shared cache directly — the
    // synchronous derive above re-runs and the card flips on the same tick.
    completeMissionOptimistic(missionId, mission, {
      onAchievementsResolved: (achievements) => {
        setNewAchievements(achievements);
      },
      onError: () => {
        setActionError("That mission didn't complete. Try again.");
      },
    });
  };

  const handleMissionAdded = async () => {
    setShowAddMission(false);
    // The new mission was written by AddMissionCard; pull the cache so it
    // appears in the room view and propagates to every other surface.
    await refreshMissionsCache();
  };

  // Fired when a mission is edited or deleted from within MissionCardFull.
  // Refresh the cache so the change lands here and on every other surface.
  const handleMissionChanged = async () => {
    await refreshMissionsCache();
  };

  const handleRoomUpdated = async () => {
    setShowEditRoom(false);
    await fetchData();
  };

  const handleDeleteRoom = async () => {
    setActionError(null);
    try {
      await deleteRoom(currentUser.uid, roomId);
      await refreshRooms();
      navigate('/base');
    } catch (error) {
      console.error('Error deleting room:', error);
      setActionError("That room didn't delete. Try again.");
      setShowMenu(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loadError || !room) {
    return (
      <div className="room-page">
        <header className="room-page-header">
          <button className="room-page-back-btn" onClick={handleBack}>
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

  // On Entire Base, apply the chip filter on top of the room-tagged set
  const chipFiltered = isEntireBase && selectedRoomChip !== 'all'
    ? missions.filter(m => m.baseLocation === selectedRoomChip)
    : missions;

  // Routine view: ignore chip filters and narrow to routine members whose
  // baseLocation matches this room (i.e., "of this room" — Entire-Base
  // routines that touch the room aren't shown here).
  const isRoutineView = taskView === 'routine';
  const visibleMissions = isRoutineView
    ? missions.filter(m => m.baseLocation === roomId && isMissionInRoutineSet(m, routineRootSet))
    : chipFiltered;

  const activeMissions = visibleMissions.filter(m => m.status === 'active');
  const completedMissions = visibleMissions.filter(m => m.status === 'completed');

  // Routine view buckets the active routine tasks by frequency, mirroring
  // the builder. Completed routine tasks aren't shown here — for "did I
  // do my routine today" the user has the today view at /routines.
  const routineBuckets = isRoutineView
    ? groupRoutineMissionsByFrequency(activeMissions, cadenceByChainRoot)
    : null;

  // Refresh routine context + parent missions after an add-to-routine so
  // both the routineRootSet and the room's mission list pick up the new task.
  const handleRoutineAdded = async () => {
    await refreshRoutines();
    await fetchData();
  };

  // Entire Base shows a segmented bar (one slice per non-base room) instead
  // of a single fill, since aggregating cleanliness into one value is misleading.
  const otherRooms = isEntireBase ? allRooms.filter(r => r.id !== ENTIRE_BASE_ROOM_ID) : [];
  const segments = isEntireBase ? buildCleanlinessSegments(otherRooms) : null;

  // Stale = user hasn't checked this room recently. Treat as fresh once the
  // user has dragged the slider away from the saved value in this session.
  const hasDraftChange = !isEntireBase && room && localCleanliness !== room.cleanliness;
  const showAsStale = !isEntireBase && !hasDraftChange && isCleanlinessStale(room);
  const cleanlinessColor = showAsStale ? CLEANLINESS_STALE_COLOR : CLEANLINESS_COLORS[localCleanliness];
  const cleanlinessLabel = showAsStale ? getCleanlinessStaleLabel(room) : CLEANLINESS_LABELS[localCleanliness];
  const cleanlinessPercent = (localCleanliness / 5) * 100;

  // Chip data: room id, label, count of room-tagged missions for that room within current `missions`
  const chipRooms = isEntireBase
    ? allRooms
        .filter(r => r.id !== ENTIRE_BASE_ROOM_ID)
        .map(r => ({
          id: r.id,
          name: r.name,
          count: missions.filter(m => m.baseLocation === r.id && m.status === 'active').length
        }))
    : [];
  const entireBaseTaggedCount = isEntireBase
    ? missions.filter(m => m.baseLocation === ENTIRE_BASE_ROOM_ID && m.status === 'active').length
    : 0;

  // Routine count for this room — extends the header stat line with a
  // "X in routine" clause when there's at least one routine member here.
  // Silent when zero so rooms without a routine don't get noise; the
  // Routine tab still does the discovery work for those.
  const routineCount = missions.filter(
    m => m.baseLocation === roomId &&
         m.status === 'active' &&
         isMissionInRoutineSet(m, routineRootSet)
  ).length;

  const scope = isEntireBase ? ' across all rooms' : '';
  const statLine = stats.total === 0
    ? `No missions${scope} yet`
    : `${stats.total} mission${stats.total !== 1 ? 's' : ''}${scope}${stats.overdue > 0 ? ` · ${stats.overdue} late` : ''}${routineCount > 0 ? ` · ${routineCount} in routine` : ''}`;

  return (
    <LoadingTransition loading={loading || missionsCacheLoading} skeleton={<RoomPageSkeleton />}>
    <div className="room-page">

      {/* Header */}
      <header className="room-page-header">
        <button className="room-page-back-btn" onClick={handleBack}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="room-page-title">{isEntireBase ? (baseName || room.name) : room.name}</h1>

        {(room.canDelete || roomId === ENTIRE_BASE_ROOM_ID) ? (
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
                      Edit {roomId === ENTIRE_BASE_ROOM_ID ? 'Base' : 'Room'}
                    </button>
                    {room.canDelete && (
                      <button
                        className="room-page-dropdown-item room-page-dropdown-item--delete"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <span className="material-icons">delete</span>
                        Delete Room
                      </button>
                    )}
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
          {isEntireBase ? (
            <CleanlinessSegmentedBar segments={segments} className="room-page-segmented-bar" />
          ) : (
            <>
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
                  className="room-page-cleanliness-slider"
                />
              )}
            </>
          )}
        </div>

        <p className="room-page-stat-line">{statLine}</p>

        {actionError && <ErrorMessage message={actionError} />}
      </div>

      {/* Per-room chip filter (Entire Base only) — only shown on the
          "All" view; Routine view is already room-scoped so chips would
          double-filter confusingly. */}
      {!isRoutineView && isEntireBase && chipRooms.length > 0 && (
        <div className="room-page-chips">
          <button
            className={`room-page-chip${selectedRoomChip === 'all' ? ' room-page-chip--active' : ''}`}
            onClick={() => setSelectedRoomChip('all')}
          >
            All
          </button>
          <button
            className={`room-page-chip${selectedRoomChip === ENTIRE_BASE_ROOM_ID ? ' room-page-chip--active' : ''}`}
            onClick={() => setSelectedRoomChip(ENTIRE_BASE_ROOM_ID)}
          >
            {baseName || 'Whole Home'} <span className="room-page-chip-count">{entireBaseTaggedCount}</span>
          </button>
          {chipRooms.map(c => (
            <button
              key={c.id}
              className={`room-page-chip${selectedRoomChip === c.id ? ' room-page-chip--active' : ''}`}
              onClick={() => setSelectedRoomChip(c.id)}
            >
              {c.name} <span className="room-page-chip-count">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Missions section — tabs at the top swap between the room's full
          mission list ("All") and its routine subset ("Routine"). The add
          button adapts to the active tab so + Add creates whichever kind
          of task you're currently looking at. */}
      <div className="room-page-missions">
        <div className="room-page-missions-header">
          <div className="room-page-task-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={taskView === 'all'}
              className={`room-page-task-tab${taskView === 'all' ? ' room-page-task-tab--active' : ''}`}
              onClick={() => setTaskView('all')}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={taskView === 'routine'}
              className={`room-page-task-tab${taskView === 'routine' ? ' room-page-task-tab--active' : ''}`}
              onClick={() => setTaskView('routine')}
            >
              Routine
            </button>
          </div>
          <button
            className="room-page-add-btn"
            onClick={() => {
              if (isRoutineView) setShowAddRoutine(true);
              else setShowAddMission(true);
            }}
          >
            {isRoutineView ? '+ Add to routine' : '+ Add'}
          </button>
        </div>

        {activeMissions.length === 0 && completedMissions.length === 0 && (
          <p className="room-page-empty">
            {isRoutineView
              ? 'No routine tasks here yet. Add one to make it part of your regular rhythm.'
              : isEntireBase
              ? (selectedRoomChip === 'all'
                  ? 'No missions across the home yet.'
                  : 'No missions for that room yet.')
              : 'No missions for this room yet.'}
          </p>
        )}

        {isRoutineView ? (
          <section className="routine-builder">
            {ROUTINE_BUCKETS.map(({ key, label }) => {
              const items = routineBuckets?.[key] || [];
              if (items.length === 0) return null;
              return (
                <div key={key} className="routine-builder-group">
                  <div className="routine-builder-group-header">
                    <div className="routine-builder-group-titlewrap">
                      <h3 className="routine-builder-group-label">{label}</h3>
                      <span className="routine-builder-group-count">{items.length}</span>
                    </div>
                  </div>
                  <div className="routine-builder-group-list">
                    {items.map((mission) => (
                      <MissionCardCondensed
                        key={mission.id}
                        mission={mission}
                        onToggleComplete={handleToggleComplete}
                        onMissionChanged={handleMissionChanged}
                        hideRoutineBadge
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          <>
            {activeMissions.map(mission => (
              <MissionCard
                key={mission.id}
                mission={mission}
                onToggleComplete={handleToggleComplete}
                onMissionChanged={handleMissionChanged}
                hideRoomBadge={!isEntireBase || selectedRoomChip !== 'all'}
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
                    onMissionChanged={handleMissionChanged}
                      />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {showAddRoutine && (
        <QuickAddRoutineSheet
          frequency={RECURRENCE_PATTERNS.DAILY}
          routineId={DEFAULT_ROUTINE_ID}
          defaultRoomId={roomId}
          showFrequencyPicker
          lockRoom
          onClose={() => setShowAddRoutine(false)}
          onAdded={handleRoutineAdded}
        />
      )}

      {/* Add Mission modal */}
      {showAddMission && (
        <AddMissionCard
          onAddMission={handleMissionAdded}
          onCancel={() => setShowAddMission(false)}
          defaultRoomId={roomId}
          autoOpenField={isEntireBase ? 'room' : null}
        />
      )}

      {/* Edit Room / Base modal */}
      {showEditRoom && (
        <AddRoomModal
          onClose={() => setShowEditRoom(false)}
          onRoomAdded={handleRoomUpdated}
          editRoom={room}
          isBaseRoom={roomId === ENTIRE_BASE_ROOM_ID}
          baseName={roomId === ENTIRE_BASE_ROOM_ID ? baseName : undefined}
        />
      )}

      <AchievementToast
        achievements={newAchievements}
        onDismiss={() => setNewAchievements([])}
      />
    </div>
    </LoadingTransition>
  );
};

export default RoomPage;
