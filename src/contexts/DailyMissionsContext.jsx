import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { getDailyMissionsConfig } from '../services/dailyMissionService';
import { toDateString } from '../utils/dateHelpers';

const DailyMissionsContext = createContext(null);

export const useDailyMissions = () => {
  const ctx = useContext(DailyMissionsContext);
  if (!ctx) throw new Error('useDailyMissions must be used within a DailyMissionsProvider');
  return ctx;
};

// Convenience hook for the common case: is this single mission today's daily?
export const useIsDailyMission = (missionId) => {
  const { isDailyMission } = useDailyMissions();
  return isDailyMission(missionId);
};

export const DailyMissionsProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [dailyMissionIds, setDailyMissionIds] = useState(() => new Set());
  const [isConfigForToday, setIsConfigForToday] = useState(false);

  const fetchDailyConfig = useCallback(async () => {
    if (!currentUser) {
      setDailyMissionIds(new Set());
      setIsConfigForToday(false);
      return;
    }
    try {
      const config = await getDailyMissionsConfig(currentUser.uid);
      const today = toDateString(new Date());
      const isToday = config?.setForDate === today;
      setIsConfigForToday(isToday);
      setDailyMissionIds(new Set(isToday ? (config?.missionIds || []) : []));
    } catch (err) {
      console.error('fetchDailyConfig failed:', err);
      setDailyMissionIds(new Set());
      setIsConfigForToday(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchDailyConfig();
  }, [currentUser, fetchDailyConfig]);

  const value = useMemo(() => ({
    dailyMissionIds,
    isConfigForToday,
    isDailyMission: (missionId) => dailyMissionIds.has(missionId),
    refreshDailyMissions: fetchDailyConfig,
  }), [dailyMissionIds, isConfigForToday, fetchDailyConfig]);

  return (
    <DailyMissionsContext.Provider value={value}>
      {children}
    </DailyMissionsContext.Provider>
  );
};
