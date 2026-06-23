// src/pages/BasePage.js
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTutorial } from '../../contexts/TutorialContext';
import { useRooms } from '../../contexts/RoomsContext';
import { useNavigate } from 'react-router-dom';
import {
  getAllRoomStats,
  initializeEntireBaseRoom,
  reorderRooms,
  createRoomsBatch,
  deleteRoom,
  ENTIRE_BASE_ROOM_ID,
} from '../../services/roomService';
import { useNotifications } from '../../contexts/NotificationContext';
import { useMissions } from '../../contexts/MissionsContext';
import { getUserProfile } from '../../services/userService';
import RoomCard from '../../components/base/RoomCard';
import AddRoomModal from '../../components/base/AddRoomModal';
import HomeTemplatePicker from '../../components/rooms/HomeTemplatePicker';
import RoomSortModal from '../../components/base/RoomSortModal';
import ErrorMessage from '../../components/ui/ErrorMessage';
import LoadingTransition from '../../components/ui/LoadingTransition';
import BasePageSkeleton from './BasePageSkeleton';
import { applyRoomSort, ROOM_SORT_DEFAULT } from '../../utils/roomListHelpers';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
import { useAndroidBackButton } from '../../hooks/useAndroidBackButton';
import { useRoutines } from '../../contexts/RoutineContext';
import { isMissionInRoutineSet } from '../../utils/routineHelpers';
import { isEvergreenMission } from '../../utils/recurrenceHelpers';
import dayjs from 'dayjs';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';

import './BasePage.css';

const BasePage = () => {
  const { currentUser } = useAuth();
  const { notifyHomeTemplateApplied } = useNotifications();
  const { triggerStep } = useTutorial();
  useEffect(() => {
    triggerStep('base');
    return () => triggerStep(null);
  }, [triggerStep]);
  const { refreshRooms } = useRooms();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [roomStats, setRoomStats] = useState([]);
  const {
    missions: allMissions,
    isInitialLoading: missionsCacheLoading,
    refresh: refreshMissionsCache,
  } = useMissions();
  const { routineRootSet } = useRoutines();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reorderError, setReorderError] = useState(null);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [showHomeTemplateModal, setShowHomeTemplateModal] = useState(false);
  const [showBaseIconModal, setShowBaseIconModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortBy, setSortBy] = useState(ROOM_SORT_DEFAULT);
  const [baseName, setBaseName] = useState('');

  const handleBack = () => navigate('/home');
  useAndroidBackButton(handleBack);

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Re-runs whenever the shared missions cache updates — keeps the per-room
  // stats and routine counts in sync with completion/edit/delete activity
  // anywhere in the app, without a redundant getAllMissions fetch here.
  const fetchRoomsAndStats = async () => {
    if (!currentUser) return;
    if (allMissions == null) return; // wait for the cache
    if (isDefinitelyOffline()) {
      setLoadError("Your rooms didn't load. Check your connection and try again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await initializeEntireBaseRoom(currentUser.uid);
      const profile = await withTimeout(getUserProfile(currentUser.uid));
      const roomsWithStats = await withTimeout(getAllRoomStats(currentUser.uid, allMissions));
      setRoomStats(roomsWithStats);
      setRooms(roomsWithStats);
      setBaseName(profile?.baseName || '');
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setLoadError(getLoadErrorMessage(error, 'rooms'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomsAndStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, allMissions]);

  const handleRoomClick = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  const handleAddRoom = () => {
    setShowAddRoomModal(true);
  };

  const handleOpenTemplatePicker = () => {
    setShowHomeTemplateModal(true);
  };

  const handleApplyTemplate = async (template) => {
    if (!currentUser || !template) return;
    const newRoomIds = await createRoomsBatch(currentUser.uid, template.rooms);
    await fetchRoomsAndStats();

    // Surface an undo toast so a wrong-template tap can be reversed without
    // manually deleting every room. Auto-dismisses in ~5s. Undo soft-deletes
    // the just-created rooms sequentially and refetches.
    notifyHomeTemplateApplied({
      templateName: template.name,
      onUndo: async () => {
        for (const roomId of newRoomIds) {
          try {
            await deleteRoom(currentUser.uid, roomId);
          } catch (e) {
            console.error('Undo: failed to delete room', roomId, e);
          }
        }
        await fetchRoomsAndStats();
      },
    });
  };

  const handleRoomAdded = async () => {
    setShowAddRoomModal(false);
    await fetchRoomsAndStats();
  };

  const isCustomOrderMode = sortBy === 'custom';
  const hasActiveSort = sortBy !== ROOM_SORT_DEFAULT;

  const displayRooms = useMemo(
    () => applyRoomSort(roomStats, sortBy),
    [roomStats, sortBy]
  );

  // Per-room routine breakdown: how many routine tasks here are on
  // today's roster (evergreens always + recurring with dueDate <= today),
  // and how many total are anchored to this room. Computed once across
  // all missions + the routine root set; each card just reads its entry.
  const routineCountsByRoomId = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(allMissions) || !routineRootSet) return map;
    const today = dayjs().startOf('day');
    for (const m of allMissions) {
      if (!m || m.status !== 'active') continue;
      if (!isMissionInRoutineSet(m, routineRootSet)) continue;
      const roomId = m.baseLocation;
      if (!roomId) continue;
      let entry = map.get(roomId);
      if (!entry) {
        entry = { today: 0, total: 0 };
        map.set(roomId, entry);
      }
      entry.total += 1;
      const dueToday =
        isEvergreenMission(m) ||
        (m.dueDate && !dayjs(m.dueDate).isAfter(today, 'day'));
      if (dueToday) entry.today += 1;
    }
    return map;
  }, [allMissions, routineRootSet]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (active.id === ENTIRE_BASE_ROOM_ID || over.id === ENTIRE_BASE_ROOM_ID) return;
    if (!isCustomOrderMode) return;

    const oldIndex = displayRooms.findIndex(r => r.id === active.id);
    const newIndex = displayRooms.findIndex(r => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(displayRooms, oldIndex, newIndex);

    // Optimistic update — re-apply order field locally so the custom sort matches.
    const reorderedWithOrder = reordered.map((r, idx) => ({ ...r, order: idx }));
    setRoomStats(reorderedWithOrder);
    setRooms(reorderedWithOrder);
    setReorderError(null);

    try {
      await reorderRooms(currentUser.uid, reordered.map(r => r.id));
      // Sync RoomsContext so AddMissionCard's room dropdown reflects the new order.
      await refreshRooms();
    } catch (err) {
      console.error('Error reordering rooms:', err);
      setReorderError("That reorder didn't save.");
      await fetchRoomsAndStats();
    }
  };

  const hasCustomRooms = rooms.length > 1; // More than just "Entire Base"

  const entireBaseRoom = rooms.find(r => r.id === ENTIRE_BASE_ROOM_ID);
  const baseIconUnset = !entireBaseRoom || entireBaseRoom.icon === 'home';

  return (
    <LoadingTransition loading={loading || missionsCacheLoading} skeleton={<BasePageSkeleton />}>
    <div className="base-page-container">
      {/* Header */}
      <header className="base-page-header">
        <button className="base-page-back-btn" onClick={handleBack}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="base-page-title">Your Base</h1>
        <div className="base-page-header-actions">
          <button
            className={`base-page-sort-btn${hasActiveSort ? ' active' : ''}`}
            onClick={() => setShowSortModal(true)}
            title="Sort rooms"
            aria-label="Sort rooms"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"></polygon>
            </svg>
            {hasActiveSort && <span className="base-page-sort-dot" />}
          </button>
          <button
            className="base-page-add-room-btn base-page-template-btn"
            onClick={handleOpenTemplatePicker}
            title="Use a home template"
            aria-label="Use a home template"
          >
            <span className="material-icons">home_work</span>
          </button>
          <button className="base-page-add-room-btn" onClick={handleAddRoom}>
            <span className="material-icons">add</span>
            Room
          </button>
        </div>
      </header>

      {loadError && (
        <ErrorMessage
          message={loadError}
          onRetry={() => { setLoadError(null); fetchRoomsAndStats(); }}
          className="base-load-error"
        />
      )}

      {reorderError && (
        <ErrorMessage
          message={reorderError}
          onRetry={() => { setReorderError(null); fetchRoomsAndStats(); }}
          className="base-load-error"
        />
      )}

      {/* Rooms Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={displayRooms.map(r => r.id)}
          strategy={rectSortingStrategy}
          disabled={!isCustomOrderMode}
        >
          <div className="rooms-grid">
            {displayRooms.map((room) => {
              const isEntireBase = room.id === ENTIRE_BASE_ROOM_ID || room.roomId === ENTIRE_BASE_ROOM_ID;
              const displayRoom = isEntireBase
                ? { ...room, name: baseName || room.name }
                : room;

              const routineCounts =
                routineCountsByRoomId.get(room.roomId || room.id) || { today: 0, total: 0 };
              return (
                <div key={room.roomId || room.id} className="room-card-slot">
                  <RoomCard
                    room={displayRoom}
                    stats={room.stats}
                    todayRoutineCount={routineCounts.today}
                    totalRoutineCount={routineCounts.total}
                    onClick={() => handleRoomClick(room.roomId || room.id)}
                    isCustomOrderMode={isCustomOrderMode}
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

            {/* First-room empty state — prominent template CTA only. The
                "+ Room" button stays in the header for users who want to add
                rooms one at a time. */}
            {!hasCustomRooms && (
              <div className="room-card-slot">
                <div
                  className="add-room-card add-room-card-template"
                  onClick={handleOpenTemplatePicker}
                >
                  <div className="add-room-icon">
                    <span className="material-icons">home_work</span>
                  </div>
                  <div className="add-room-label">Pick a home template</div>
                </div>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Room Modal */}
      {showAddRoomModal && (
        <AddRoomModal
          onClose={() => setShowAddRoomModal(false)}
          onRoomAdded={handleRoomAdded}
        />
      )}

      {/* Home Template Picker — batch room creation */}
      <HomeTemplatePicker
        open={showHomeTemplateModal}
        onClose={() => setShowHomeTemplateModal(false)}
        onApply={handleApplyTemplate}
      />

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

      {/* Sort Modal */}
      <RoomSortModal
        isOpen={showSortModal}
        onClose={() => setShowSortModal(false)}
        currentSortBy={sortBy}
        onApply={setSortBy}
      />
    </div>
    </LoadingTransition>
  );
};

export default BasePage;
