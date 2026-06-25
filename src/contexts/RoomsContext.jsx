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

  const fetchRooms = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await getRooms(currentUser.uid);
      setRooms(data);
      setRoomsMap(Object.fromEntries(data.map(r => [r.id, r])));
    } catch (err) {
      console.error('fetchRooms failed:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setRooms([]);
      setRoomsMap({});
      return;
    }
    fetchRooms();
  }, [currentUser, fetchRooms]);

  return (
    <RoomsContext.Provider value={{ rooms, roomsMap, refreshRooms: fetchRooms }}>
      {children}
    </RoomsContext.Provider>
  );
};
