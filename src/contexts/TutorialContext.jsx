// src/contexts/TutorialContext.jsx
//
// Drives the tutorial overlay system:
//   - Derives the user's active tutorial quest from QuestsContext (single
//     source of truth so multi-tab Just Works).
//   - Owns the activeStep state (which step is open, which screen of it).
//   - Prepends the universal welcome screen on the first step opened per
//     account, gated by a `tutorialWelcomeSeen` flag on the user doc.
//   - Exposes APIs the overlay + tutorial cards call into.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

import { db } from '../services/firebase/config';
import { useAuth } from './AuthContext';
import { useQuests } from './QuestsContext';
import { useMissions } from './MissionsContext';
import { useNotifications } from './NotificationContext';
import { QUEST_TYPE } from '../types/Quests';
import { MISSION_STATUS } from '../types/Mission';
import { TUTORIAL_STEPS } from '../data/tutorialQuest';
import { getScriptForStep, WELCOME_SCREEN } from '../data/tutorialScript';
import { completeMissionWithRecurrence } from '../services/missionService';

// Maps feature page identifiers to tutorial step keys. Feature pages call
// `triggerStep('mission-bank')` on mount; the context resolves to the
// matching tutorial step and opens the overlay if it's still incomplete.
const FEATURE_KEY_TO_STEP = {
  'mission-bank': TUTORIAL_STEPS.CREATE_FIRST_MISSION,
  'daily-plan':   TUTORIAL_STEPS.PLAN_FIRST_DAY,
  'daily-review': TUTORIAL_STEPS.FIRST_DAILY_REVIEW,
  'base':         TUTORIAL_STEPS.SETUP_BASE,
  'routine':      TUTORIAL_STEPS.FIRST_ROUTINE,
  'quests':       TUTORIAL_STEPS.TOUR_QUESTS,
  'skills':       TUTORIAL_STEPS.TOUR_SKILLS,
  'achievements': TUTORIAL_STEPS.TOUR_ACHIEVEMENTS,
};

const TutorialContext = createContext(null);

export const useTutorial = () => {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    // Soft fallback — components in trees without the provider get no-ops.
    // This makes tests and isolated component renders not blow up.
    return {
      activeTutorialQuest: null,
      activeStep: null,
      isTutorialMission: () => false,
      openStepForMission: () => {},
      triggerStep: () => {},
      advance: () => {},
      completeCurrentStep: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
};

export const TutorialProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { quests, refreshQuests } = useQuests();
  const { missions, refresh: refreshMissionsCache } = useMissions();
  const { notifyTutorialStepComplete } = useNotifications();
  const navigate = useNavigate();

  // Tracks which steps have already auto-fired in this browser session.
  // Survives dismissal so bouncing back to a feature page doesn't re-open
  // the overlay every time. Cleared on full reload.
  const autoTriggeredRef = useRef(new Set());

  // welcomeSeen: null = unknown (haven't read user doc), true = seen, false = not seen.
  // Defaulting null means we never accidentally show welcome twice during the
  // doc-read race; we only show it when we *know* it hasn't been seen.
  const [welcomeSeen, setWelcomeSeen] = useState(null);

  // activeStep: { missionId, tutorialStep, screens, screenIndex, completionTrigger }
  //             or null when no overlay is showing.
  const [activeStep, setActiveStep] = useState(null);

  // The feature key the user is currently on. Set by pages via triggerStep().
  // A resolver useEffect below opens the overlay as soon as data is ready —
  // decoupled from page lifecycle so cold data loads don't miss the auto-fire
  // window. Pages clear this on unmount so a stale key doesn't fire on the
  // wrong screen after navigation.
  const [pendingFeatureKey, setPendingFeatureKey] = useState(null);

  // Derive the user's active tutorial quest from QuestsContext.
  const activeTutorialQuest = useMemo(() =>
    quests.find(q => q.type === QUEST_TYPE.TUTORIAL && q.status === 'active') ?? null,
    [quests]
  );

  // Read tutorialWelcomeSeen from user doc on currentUser change.
  useEffect(() => {
    if (!currentUser) {
      setWelcomeSeen(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (cancelled) return;
        setWelcomeSeen(snap.exists() && snap.data().tutorialWelcomeSeen === true);
      } catch {
        if (!cancelled) setWelcomeSeen(true); // safe default — skip welcome
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  const isTutorialMission = useCallback(
    (mission) => !!mission?.tutorialStep,
    []
  );

  const openStepForMission = useCallback((mission) => {
    if (!mission?.tutorialStep) return;
    const script = getScriptForStep(mission.tutorialStep);
    if (!script) return;

    // Prepend welcome screen only when we know it hasn't been seen.
    // welcomeSeen === false means "definitely not seen"; null and true skip.
    const screens = welcomeSeen === false
      ? [WELCOME_SCREEN, ...script.screens]
      : script.screens;

    // Mark this step as auto-triggered so the resolver useEffect doesn't
    // clobber screenIndex back to 0 when the user lands on a feature page
    // whose triggerStep would otherwise re-open the same step. Applies to
    // every open path: play button, manual mission tap, navigateTo landing.
    autoTriggeredRef.current.add(mission.tutorialStep);

    setActiveStep({
      missionId: mission.id,
      tutorialStep: mission.tutorialStep,
      screens,
      screenIndex: 0,
      completionTrigger: script.completionTrigger,
    });
  }, [welcomeSeen]);

  // Mark the welcome screen as seen — fires the moment the user advances
  // past it. Idempotent: safe to call repeatedly.
  const markWelcomeSeen = useCallback(async () => {
    if (welcomeSeen === true || !currentUser) return;
    setWelcomeSeen(true);
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        { tutorialWelcomeSeen: true },
        { merge: true }
      );
    } catch (e) {
      console.error('Failed to persist tutorialWelcomeSeen:', e);
    }
  }, [welcomeSeen, currentUser]);

  // Explicitly complete the current tutorial mission and dismiss.
  const completeCurrentStep = useCallback(async () => {
    if (!activeStep || !currentUser) return;
    const missionId = activeStep.missionId;
    setActiveStep(null);
    try {
      await completeMissionWithRecurrence(currentUser.uid, missionId);
      // Refresh caches so the user sees the updated state immediately.
      refreshQuests?.();
      refreshMissionsCache?.();
    } catch (e) {
      console.error('Tutorial mission completion failed:', e);
    }
  }, [activeStep, currentUser, refreshQuests, refreshMissionsCache]);

  // Advance one screen. If the current screen has a `navigateTo`, route
  // the user there first (the overlay stays mounted at App level so it
  // travels with them). If at the last screen and trigger is 'manual',
  // completes the mission and dismisses. If at the last screen and trigger
  // is 'auto', just dismisses (the user will perform the real action and
  // the watcher will complete the mission separately).
  const advance = useCallback(async () => {
    if (!activeStep) return;
    const currentScreen = activeStep.screens[activeStep.screenIndex];
    const isLast = activeStep.screenIndex >= activeStep.screens.length - 1;
    const onWelcome = currentScreen === WELCOME_SCREEN;

    if (onWelcome) {
      // Fire-and-forget the persistence. Don't block UI.
      markWelcomeSeen();
    }

    // Per-screen navigation. Fires before screen index advances so the new
    // route mounts in time for any spotlight target on the next screen.
    if (currentScreen?.navigateTo) {
      navigate(currentScreen.navigateTo);
    }

    if (!isLast) {
      setActiveStep(prev => prev ? { ...prev, screenIndex: prev.screenIndex + 1 } : null);
      return;
    }

    // Last screen — complete (manual) or close (auto).
    if (activeStep.completionTrigger === 'manual') {
      await completeCurrentStep();
    } else {
      setActiveStep(null);
    }
  }, [activeStep, markWelcomeSeen, completeCurrentStep, navigate]);

  const dismiss = useCallback(() => setActiveStep(null), []);

  // Tutorial step completion toast. Watches the missions array for tutorial
  // missions transitioning active → completed and fires a lightweight
  // celebration via NotificationContext. The map of prior statuses lives in
  // a ref so re-renders don't re-fire the same toast.
  const prevTutorialStatusesRef = useRef(null);
  useEffect(() => {
    if (!missions) return;
    const tutorialMissions = missions.filter(m => m.tutorialStep);
    // First pass after data loads — record baseline and bail. Avoids firing
    // for already-completed missions on initial load (e.g., page refresh).
    if (prevTutorialStatusesRef.current === null) {
      prevTutorialStatusesRef.current = Object.fromEntries(
        tutorialMissions.map(m => [m.id, m.status])
      );
      return;
    }
    for (const m of tutorialMissions) {
      const prev = prevTutorialStatusesRef.current[m.id];
      if (prev === MISSION_STATUS.ACTIVE && m.status === MISSION_STATUS.COMPLETED) {
        notifyTutorialStepComplete({
          missionTitle: m.title,
          questId: m.questId ?? null,
        });
      }
      prevTutorialStatusesRef.current[m.id] = m.status;
    }
  }, [missions, notifyTutorialStepComplete]);

  // Wait-state advance: when the current screen is a `wait` variant, watch
  // the appropriate context data and auto-advance once the watched event
  // fires (e.g., user creates a mission). Baseline is captured on entry to
  // the wait state so growth-since-entry is what triggers advance — not
  // pre-existing data.
  const waitBaselineRef = useRef(null);
  useEffect(() => {
    if (!activeStep) {
      waitBaselineRef.current = null;
      return;
    }
    const currentScreen = activeStep.screens[activeStep.screenIndex];
    if (currentScreen?.variant !== 'wait') {
      waitBaselineRef.current = null;
      return;
    }

    if (currentScreen.waitFor === 'mission-created') {
      const count = missions?.length ?? 0;
      if (waitBaselineRef.current === null) {
        waitBaselineRef.current = count;
        return;
      }
      if (count > waitBaselineRef.current) {
        waitBaselineRef.current = null;
        // Defer one tick so other listeners (e.g., MissionsContext refresh)
        // settle before the next overlay screen renders.
        setTimeout(() => {
          setActiveStep(prev => prev
            ? { ...prev, screenIndex: prev.screenIndex + 1 }
            : null);
        }, 0);
      }
    }
  }, [activeStep, missions]);

  // Auto-fire entry point. Feature pages call this on mount with their
  // feature key, and again with null on unmount to clear. The function
  // itself is intentionally stable (no deps) — it just records intent.
  // The resolver useEffect below opens the overlay the moment data
  // conditions are met, so a cold data load can't miss the window.
  const triggerStep = useCallback((featureKey) => {
    setPendingFeatureKey(featureKey ?? null);
  }, []);

  // Resolver — fires whenever any condition changes. Opens the overlay
  // the instant: (a) a feature page has registered its key, (b) data
  // (quest + missions) has loaded, (c) the matching tutorial mission is
  // still active, and (d) this step hasn't already auto-fired this session.
  useEffect(() => {
    if (!pendingFeatureKey) return;
    const stepKey = FEATURE_KEY_TO_STEP[pendingFeatureKey];
    if (!stepKey) return;
    if (autoTriggeredRef.current.has(stepKey)) return;
    if (!activeTutorialQuest) return;
    if (!missions) return; // null until first fetch resolves

    const mission = missions.find(
      m => m.tutorialStep === stepKey && m.status === MISSION_STATUS.ACTIVE
    );
    if (!mission) return;

    autoTriggeredRef.current.add(stepKey);
    setPendingFeatureKey(null);
    openStepForMission(mission);
  }, [pendingFeatureKey, activeTutorialQuest, missions, openStepForMission]);

  const value = useMemo(() => ({
    activeTutorialQuest,
    activeStep,
    isTutorialMission,
    openStepForMission,
    triggerStep,
    advance,
    completeCurrentStep,
    dismiss,
  }), [
    activeTutorialQuest,
    activeStep,
    isTutorialMission,
    openStepForMission,
    triggerStep,
    advance,
    completeCurrentStep,
    dismiss,
  ]);

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
};
