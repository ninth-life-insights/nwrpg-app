// src/contexts/NotificationContext.js
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import LevelUpModal from '../components/ui/LevelUpModal';
import SkillLevelUpModal from '../components/ui/SkillLevelUpModal';
import UndoActionToast from '../components/ui/UndoActionToast';
import TutorialStepToast from '../components/tutorial/TutorialStepToast';
import AchievementToast from '../components/achievements/AchievementToast';
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
  const [tutorialStepToast, setTutorialStepToast] = useState(null);
  const tutorialStepToastIdRef = useRef(0);
  // Per-session dedupe: each tutorial step only ever produces one toast in
  // the lifetime of this provider. Guards against any re-fire path that
  // would resurrect the toast after the user dismisses it (observed once on
  // an older iOS PWA where the X tap didn't make it go away).
  const shownTutorialStepsRef = useRef(new Set());

  // Achievement toast queue. Pages call notifyAchievementsUnlocked with the
  // batch of achievements unlocked by an action; we queue them so that
  // (a) the tutorial step toast always shows first (Christine's call — the
  // tutorial step completion celebration takes precedence over the
  // achievement reward), and (b) multiple unlocks in quick succession queue
  // sequentially instead of stacking on top of each other.
  const [currentAchievementToast, setCurrentAchievementToast] = useState(null);
  const [achievementToastQueue, setAchievementToastQueue] = useState([]);
  const achievementToastIdRef = useRef(0);

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
          tag: 'review-your-day',
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

  // Routine builder drag-across-buckets is reversible — surfaces an undo so
  // an accidental drag (or a destructive rebucket that wiped fancy recurrence
  // config) can be rolled back. Target bucket name is in the label so the
  // user sees what changed at a glance.
  const notifyRoutineRebucketed = useCallback(({ missionTitle, bucketLabel, onUndo }) => {
    showUndoToast({ label: `Moved to ${bucketLabel}`, missionTitle, onUndo });
  }, [showUndoToast]);

  // Home template batch room creation — undo soft-deletes every room from
  // the batch. The window is short (toast auto-dismisses), so the practical
  // risk of undoing into a freshly-edited room is small.
  const notifyHomeTemplateApplied = useCallback(({ templateName, onUndo }) => {
    showUndoToast({ label: 'Home template added', missionTitle: templateName, onUndo });
  }, [showUndoToast]);

  // Tutorial mission step completion — lightweight celebration toast.
  // Fired by TutorialContext when it observes a tutorial mission flipping
  // from active to completed. The id changes per call so the toast remounts
  // and its auto-dismiss timer resets if steps complete in quick succession.
  //
  // Dedupe by tutorialStep: a given step only ever produces one toast per
  // provider lifetime, so a stray re-fire can't resurrect a dismissed toast.
  const notifyTutorialStepComplete = useCallback(({ tutorialStep, missionTitle, questId }) => {
    if (tutorialStep && shownTutorialStepsRef.current.has(tutorialStep)) return;
    if (tutorialStep) shownTutorialStepsRef.current.add(tutorialStep);
    tutorialStepToastIdRef.current += 1;
    setTutorialStepToast({
      id: tutorialStepToastIdRef.current,
      missionTitle,
      questId,
    });
  }, []);

  // Achievement unlock toast — queued so it shows after any active tutorial
  // step toast (so the tutorial celebration always lands first) and after
  // any currently-rendering achievement batch (so rapid successive unlocks
  // don't stack on top of each other).
  const notifyAchievementsUnlocked = useCallback((achievements) => {
    if (!achievements?.length) return;
    achievementToastIdRef.current += 1;
    setAchievementToastQueue(prev => [
      ...prev,
      { id: achievementToastIdRef.current, achievements },
    ]);
  }, []);

  // Dequeue: when there's no tutorial step toast in flight and no current
  // achievement toast rendering, promote the next queued batch.
  useEffect(() => {
    if (tutorialStepToast) return;
    if (currentAchievementToast) return;
    if (achievementToastQueue.length === 0) return;
    setCurrentAchievementToast(achievementToastQueue[0]);
    setAchievementToastQueue(prev => prev.slice(1));
  }, [tutorialStepToast, currentAchievementToast, achievementToastQueue]);

  return (
    <NotificationContext.Provider value={{
      notifyMissionCompletion,
      notifyLevelUp,
      notifySkillLevelUp,
      notifyMissionDeleted,
      notifyMissionArchived,
      notifyQuestDeleted,
      notifyQuestArchived,
      notifyRoutineRebucketed,
      notifyHomeTemplateApplied,
      notifyTutorialStepComplete,
      notifyAchievementsUnlocked,
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

      {tutorialStepToast && (
        <TutorialStepToast
          key={tutorialStepToast.id}
          step={tutorialStepToast}
          onDismiss={() => setTutorialStepToast(null)}
        />
      )}

      {currentAchievementToast && (
        <AchievementToast
          key={currentAchievementToast.id}
          achievements={currentAchievementToast.achievements}
          onDismiss={() => setCurrentAchievementToast(null)}
        />
      )}
    </NotificationContext.Provider>
  );
};
