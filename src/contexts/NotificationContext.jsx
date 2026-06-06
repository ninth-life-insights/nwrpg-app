// src/contexts/NotificationContext.js
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import LevelUpModal from '../components/ui/LevelUpModal';
import SkillLevelUpModal from '../components/ui/SkillLevelUpModal';
import UndoActionToast from '../components/ui/UndoActionToast';
import { useAuth } from './AuthContext';
import { getNotificationPrefs } from '../services/notificationPrefsService';
import {
  hasPermission,
  showNotification,
  msUntil,
  checkAndFirePlanYourDayAlert,
  checkAndFireDueTodayAlert,
  // checkAndFireOverdueAlert,
} from '../services/notificationService';

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  // --- In-app modal state (level-up / skill-up) ---
  const [levelUpInfo, setLevelUpInfo] = useState(null);
  const [skillLevelUpInfo, setSkillLevelUpInfo] = useState(null);
  const [actionToast, setActionToast] = useState(null);
  const actionToastIdRef = useRef(0);

  // --- Push notification scheduling ---
  const { currentUser } = useAuth();
  const scheduledTimerIds = useRef([]);

  const clearAllScheduled = () => {
    scheduledTimerIds.current.forEach(clearTimeout);
    scheduledTimerIds.current = [];
  };

  const scheduleAll = useCallback((prefs) => {
    clearAllScheduled();
    if (!prefs?.enabled || !hasPermission()) return;

    if (prefs.planYourDay?.enabled && currentUser) {
      const id = setTimeout(
        () => checkAndFirePlanYourDayAlert(currentUser.uid),
        msUntil(prefs.planYourDay.hour, prefs.planYourDay.minute)
      );
      scheduledTimerIds.current.push(id);
    }

    if (prefs.reviewYourDay?.enabled) {
      const id = setTimeout(
        () => showNotification('Today\'s tale is ready', {
          body: 'Read how your adventure unfolded',
          url: '/daily-review',
        }),
        msUntil(prefs.reviewYourDay.hour, prefs.reviewYourDay.minute)
      );
      scheduledTimerIds.current.push(id);
    }

    // Due-today and overdue alerts fire at a fixed 9:00 AM
    if (prefs.dueTodayAlerts?.enabled && currentUser) {
      const id = setTimeout(
        () => checkAndFireDueTodayAlert(currentUser.uid),
        msUntil(9, 0)
      );
      scheduledTimerIds.current.push(id);
    }

    // if (prefs.overdueAlerts?.enabled && currentUser) {
    //   const id = setTimeout(
    //     () => checkAndFireOverdueAlert(currentUser.uid),
    //     msUntil(9, 0)
    //   );
    //   scheduledTimerIds.current.push(id);
    // }
  }, [currentUser]);

  // Load prefs and kick off scheduling whenever the logged-in user changes
  useEffect(() => {
    if (!currentUser) {
      clearAllScheduled();
      return;
    }

    getNotificationPrefs(currentUser.uid).then((prefs) => {
      scheduleAll(prefs);
    });

    return () => clearAllScheduled();
  }, [currentUser, scheduleAll]);

  // Re-reads prefs from Firestore and re-arms all timers.
  // Call this from SettingsPage after saving updated preferences.
  const refreshSchedule = useCallback(async () => {
    if (!currentUser) return;
    const prefs = await getNotificationPrefs(currentUser.uid);
    scheduleAll(prefs);
  }, [currentUser, scheduleAll]);

  // --- In-app modal notifiers (unchanged) ---

  // Call after any mission completion to handle both notifications automatically
  const notifyMissionCompletion = useCallback((result) => {
    if (!result) return;
    if (result.leveledUp && result.newLevel) {
      setLevelUpInfo({ newLevel: result.newLevel });
    }
    if (result.skillLeveledUp && result.skillName) {
      setSkillLevelUpInfo({ skillName: result.skillName, newLevel: result.newSkillLevel });
    }
  }, []);

  // Individual notifiers if needed directly
  const notifyLevelUp = useCallback((newLevel) => {
    setLevelUpInfo({ newLevel });
  }, []);

  const notifySkillLevelUp = useCallback((skillName, newLevel) => {
    setSkillLevelUpInfo({ skillName, newLevel });
  }, []);

  // Show an undo toast for an action on a mission. The id changes per call
  // so the toast remounts and its auto-dismiss timer resets, which matters
  // when multiple actions fire in rapid succession.
  const showUndoToast = useCallback(({ label, missionTitle, onUndo }) => {
    actionToastIdRef.current += 1;
    setActionToast({ id: actionToastIdRef.current, label, missionTitle, onUndo });
  }, []);

  const notifyMissionDeleted = useCallback(({ missionTitle, onUndo }) => {
    showUndoToast({ label: 'Mission deleted', missionTitle, onUndo });
  }, [showUndoToast]);

  const notifyMissionArchived = useCallback(({ missionTitle, onUndo }) => {
    showUndoToast({ label: 'Mission archived', missionTitle, onUndo });
  }, [showUndoToast]);

  const notifyQuestDeleted = useCallback(({ questTitle, onUndo }) => {
    showUndoToast({ label: 'Quest deleted', missionTitle: questTitle, onUndo });
  }, [showUndoToast]);

  const notifyQuestArchived = useCallback(({ questTitle, onUndo }) => {
    showUndoToast({ label: 'Quest archived', missionTitle: questTitle, onUndo });
  }, [showUndoToast]);

  return (
    <NotificationContext.Provider value={{
      notifyMissionCompletion,
      notifyLevelUp,
      notifySkillLevelUp,
      notifyMissionDeleted,
      notifyMissionArchived,
      notifyQuestDeleted,
      notifyQuestArchived,
      refreshSchedule,
    }}>
      {children}

      {levelUpInfo && (
        <LevelUpModal
          newLevel={levelUpInfo.newLevel}
          onClose={() => setLevelUpInfo(null)}
        />
      )}

      {skillLevelUpInfo && (
        <SkillLevelUpModal
          skillName={skillLevelUpInfo.skillName}
          newLevel={skillLevelUpInfo.newLevel}
          onClose={() => setSkillLevelUpInfo(null)}
        />
      )}

      {actionToast && (
        <UndoActionToast
          key={actionToast.id}
          label={actionToast.label}
          missionTitle={actionToast.missionTitle}
          onUndo={actionToast.onUndo}
          onDismiss={() => setActionToast(null)}
        />
      )}
    </NotificationContext.Provider>
  );
};
