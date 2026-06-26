// src/contexts/RoomsContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getRooms } from '../services/roomService';

const RoomsContext = createContext(null);

export const useRooms = () => {
  const ctx = useContext(RoomsContext);
  if (!ctx) throw new Error('useRooms must be used within a RoomsProvider');
  return ctx;
};

export const RoomsProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [roomsMap, setRoomsMap] = useState({});
  // Flips true after the first fetch settles (success or error). Lets
  // consumers like the tutorial wait-state distinguish "no rooms yet" from
  // "rooms haven't loaded yet" — without that, a slow first load looks like
  // rooms appearing from nothing and trips growth-based watchers.
  const [roomsLoaded, setRoomsLoaded] = useState(false);

  const fetchRooms = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await getRooms(currentUser.uid);
      setRooms(data);
      setRoomsMap(Object.fromEntries(data.map(r => [r.id, r])));
    } catch (err) {
      console.error('fetchRooms failed:', err);
    } finally {
      setRoomsLoaded(true);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setRooms([]);
      setRoomsMap({});
      setRoomsLoaded(false);
      return;
    }
    fetchRooms();
  }, [currentUser, fetchRooms]);

  return (
    <RoomsContext.Provider value={{ rooms, roomsMap, roomsLoaded, refreshRooms: fetchRooms }}>
      {children}
    </RoomsContext.Provider>
  );
};
