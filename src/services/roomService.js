// src/services/roomService.js
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  setDoc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase/config';

// Special room ID for "Entire Base"
export const ENTIRE_BASE_ROOM_ID = 'entire-base';

// Get user's rooms collection reference
const getUserRoomsRef = (userId) => {
  return collection(db, 'users', userId, 'rooms');
};

// Initialize "Entire Base" room for new users
export const initializeEntireBaseRoom = async (userId) => {
  try {
    const entireBaseRef = doc(db, 'users', userId, 'rooms', ENTIRE_BASE_ROOM_ID);
    const entireBaseSnap = await getDoc(entireBaseRef);
    
    if (!entireBaseSnap.exists()) {
      await setDoc(entireBaseRef, {
        name: 'Entire Base',
        icon: 'home', // Material icon name
        order: 0,
        cleanliness: 3, // Default to middle cleanliness
        isDefault: true,
        canDelete: false,
        createdAt: serverTimestamp()
      });
      console.log('Initialized Entire Base room');
    }
    
    return ENTIRE_BASE_ROOM_ID;
  } catch (error) {
    console.error('Error initializing Entire Base room:', error);
    throw error;
  }
};

// Create a new room
export const createRoom = async (userId, roomData) => {
  try {
    const roomsRef = getUserRoomsRef(userId);
    
    // Get current max order to add new room at the end
    const rooms = await getRooms(userId);
    const maxOrder = rooms.length > 0 
      ? Math.max(...rooms.map(r => r.order || 0)) 
      : 0;
    
    const docRef = await addDoc(roomsRef, {
      name: roomData.name,
      icon: roomData.icon || 'room',
      order: maxOrder + 1,
      cleanliness: roomData.cleanliness || 3,
      isDefault: false,
      canDelete: true,
      createdAt: serverTimestamp()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating room:', error);
    throw error;
  }
};

// Get all rooms for a user
export const getRooms = async (userId) => {
  try {
    const roomsRef = getUserRoomsRef(userId);
    const q = query(roomsRef, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(room => room.status !== 'deleted');
  } catch (error) {
    console.error('Error getting rooms:', error);
    throw error;
  }
};

// Get a single room by ID
export const getRoom = async (userId, roomId) => {
  try {
    const roomRef = doc(db, 'users', userId, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (roomSnap.exists()) {
      return {
        id: roomSnap.id,
        ...roomSnap.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting room:', error);
    throw error;
  }
};

// Update a room
export const updateRoom = async (userId, roomId, updates) => {
  try {
    const roomRef = doc(db, 'users', userId, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
      throw new Error('Room not found');
    }
    
    const roomData = roomSnap.data();
    
    // Prevent updating protected fields on default rooms
    if (roomData.isDefault && (updates.name || updates.canDelete !== undefined)) {
      throw new Error('Cannot modify protected fields on default rooms');
    }
    
    await updateDoc(roomRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating room:', error);
    throw error;
  }
};

// Update room cleanliness
export const updateRoomCleanliness = async (userId, roomId, cleanliness) => {
  try {
    if (cleanliness < 1 || cleanliness > 5) {
      throw new Error('Cleanliness must be between 1 and 5');
    }
    
    return await updateRoom(userId, roomId, { cleanliness });
  } catch (error) {
    console.error('Error updating room cleanliness:', error);
    throw error;
  }
};

// Update room order (for manual reordering)
export const updateRoomOrder = async (userId, roomId, newOrder) => {
  try {
    return await updateRoom(userId, roomId, { order: newOrder });
  } catch (error) {
    console.error('Error updating room order:', error);
    throw error;
  }
};

// Reorder all rooms (when dragging to reorder)
export const reorderRooms = async (userId, orderedRoomIds) => {
  try {
    const batch = orderedRoomIds.map((roomId, index) => 
      updateRoom(userId, roomId, { order: index })
    );
    
    await Promise.all(batch);
    return { success: true };
  } catch (error) {
    console.error('Error reordering rooms:', error);
    throw error;
  }
};

// Delete a room (soft delete)
export const deleteRoom = async (userId, roomId) => {
  try {
    const roomRef = doc(db, 'users', userId, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error('Room not found');
    }

    const roomData = roomSnap.data();

    if (!roomData.canDelete) {
      throw new Error('This room cannot be deleted');
    }

    await updateDoc(roomRef, {
      status: 'deleted',
      deletedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting room:', error);
    throw error;
  }
};

// Compute task-count stats from a given mission subset
const computeStatsFromMissions = (missionsSubset) => {
  const now = new Date();
  const oneWeekFromNow = new Date();
  oneWeekFromNow.setDate(now.getDate() + 7);

  const activeMissions = missionsSubset.filter(m => m.status !== 'completed' && m.status !== 'deleted');

  const stats = {
    total: activeMissions.length,
    dueThisWeek: 0,
    overdue: 0
  };

  missionsSubset.forEach(mission => {
    if (mission.dueDate) {
      const dueDate = mission.dueDate.toDate ? mission.dueDate.toDate() : new Date(mission.dueDate);

      if (dueDate < now && mission.status !== 'completed') {
        stats.overdue++;
      } else if (dueDate <= oneWeekFromNow && mission.status !== 'completed') {
        stats.dueThisWeek++;
      }
    }
  });

  return stats;
};

// Get room statistics (task counts)
export const getRoomStats = async (roomId, missions) => {
  try {
    const roomMissions = missions.filter(m => m.baseLocation === roomId);
    return computeStatsFromMissions(roomMissions);
  } catch (error) {
    console.error('Error getting room stats:', error);
    return { total: 0, dueThisWeek: 0, overdue: 0 };
  }
};

// Get stats for all rooms.
// Entire Base is overridden with an aggregate: counts roll up missions tagged to
// any room (including entire-base itself), cleanliness is the average of other rooms.
export const getAllRoomStats = async (userId, missions) => {
  try {
    const rooms = await getRooms(userId);

    const statsPromises = rooms.map(async (room) => ({
      roomId: room.id,
      ...room,
      stats: await getRoomStats(room.id, missions)
    }));

    const roomsWithStats = await Promise.all(statsPromises);

    const otherRooms = roomsWithStats.filter(r => r.id !== ENTIRE_BASE_ROOM_ID);
    const aggregateStats = computeStatsFromMissions(missions.filter(m => m.baseLocation));
    const avgCleanliness = otherRooms.length > 0
      ? Math.round(otherRooms.reduce((sum, r) => sum + (r.cleanliness || 3), 0) / otherRooms.length)
      : 3;

    return roomsWithStats.map(r =>
      r.id === ENTIRE_BASE_ROOM_ID
        ? { ...r, stats: aggregateStats, cleanliness: avgCleanliness, aggregatedRoomCount: otherRooms.length }
        : r
    );
  } catch (error) {
    console.error('Error getting all room stats:', error);
    throw error;
  }
};

// Check if user has initialized their rooms (has Entire Base)
export const hasInitializedRooms = async (userId) => {
  try {
    const entireBaseRef = doc(db, 'users', userId, 'rooms', ENTIRE_BASE_ROOM_ID);
    const entireBaseSnap = await getDoc(entireBaseRef);
    return entireBaseSnap.exists();
  } catch (error) {
    console.error('Error checking room initialization:', error);
    return false;
  }
};