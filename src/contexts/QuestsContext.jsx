// src/contexts/QuestsContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getAllQuests } from '../services/questService';

const QuestsContext = createContext(null);

export const useQuests = () => {
  const ctx = useContext(QuestsContext);
  if (!ctx) throw new Error('useQuests must be used within a QuestsProvider');
  return ctx;
};

export const QuestsProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [quests, setQuests] = useState([]);
  const [questsMap, setQuestsMap] = useState({});

  const fetchQuests = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await getAllQuests(currentUser.uid);
      setQuests(data);
      setQuestsMap(Object.fromEntries(data.map(q => [q.id, q])));
    } catch (err) {
      console.error('fetchQuests failed:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) { setQuests([]); setQuestsMap({}); return; }
    fetchQuests();
  }, [currentUser, fetchQuests]);

  return (
    <QuestsContext.Provider value={{ quests, questsMap, refreshQuests: fetchQuests }}>
      {children}
    </QuestsContext.Provider>
  );
};
