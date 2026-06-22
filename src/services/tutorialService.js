// src/services/tutorialService.js
//
// Initializes the onboarding "Training Grounds" quest at signup. Atomic via
// writeBatch — the quest, all its missions, and the daily priorities seed
// either all commit or none do. Mirrors CreateQuestModal's batched-create
// pattern so a mid-loop failure can't orphan missions in the bank.
//
// Also exposes completeTutorialStepIfActive, the Phase 1 watcher hook —
// fired from completion-triggering service functions so tutorial missions
// auto-complete when the user organically performs the underlying action.

import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from './firebase/config';
import { createQuestTemplate } from '../types/Quests';
import { createMissionTemplate, MISSION_STATUS } from '../types/Mission';
import { toDateString } from '../utils/dateHelpers';
import {
  TUTORIAL_QUEST,
  TUTORIAL_MISSIONS,
  TUTORIAL_DAILY_PRIORITY_COUNT,
} from '../data/tutorialQuest';

/**
 * Seeds the user's first quest ("The Training Grounds") with all its tutorial
 * missions, and sets the first N missions as today's daily priorities.
 *
 * Idempotent on caller intent only — repeated calls will create duplicate
 * quests. CharacterCreationPage gates this behind the signup flow, and the
 * HomePage retry only fires when `tutorialSeedFailed` is set, so re-entry
 * isn't a concern under normal flows.
 *
 * @param {string} userId
 * @returns {Promise<{ questId: string, missionIds: string[] }>}
 */
export const initializeTutorialQuest = async (userId) => {
  const missionsCol = collection(db, 'users', userId, 'missions');
  const questsCol = collection(db, 'users', userId, 'quests');

  // Pre-generate refs so the quest doc can carry missionIds before either is
  // actually written. Same trick CreateQuestModal uses.
  const missionRefs = TUTORIAL_MISSIONS.map(() => doc(missionsCol));
  const questRef = doc(questsCol);
  const missionIds = missionRefs.map(r => r.id);

  const batch = writeBatch(db);

  // Missions — built from createMissionTemplate so the schema stays in sync,
  // with tutorial-specific fields (tutorialStep, questId) layered on top.
  TUTORIAL_MISSIONS.forEach((tutorialMission, i) => {
    const tpl = createMissionTemplate({
      title: tutorialMission.title,
      description: tutorialMission.description,
      difficulty: tutorialMission.difficulty,
      dueType: tutorialMission.dueType,
      tutorialStep: tutorialMission.tutorialStep,
      questId: questRef.id,
    });
    const { id: _omitMissionId, ...missionData } = tpl;
    batch.set(missionRefs[i], {
      ...missionData,
      status: MISSION_STATUS.ACTIVE,
      createdAt: serverTimestamp(),
      completedAt: null,
    });
  });

  // Quest — title, description, difficulty, type, priority from the static
  // template; mission IDs/order pre-populated.
  const questTpl = createQuestTemplate({
    title: TUTORIAL_QUEST.title,
    description: TUTORIAL_QUEST.description,
    difficulty: TUTORIAL_QUEST.difficulty,
    type: TUTORIAL_QUEST.type,
    priority: TUTORIAL_QUEST.priority,
    status: 'active',
    missionIds,
    missionOrder: missionIds,
    completedMissionIds: [],
    totalMissions: missionIds.length,
    completedMissions: 0,
  });
  const { id: _omitQuestId, ...questData } = questTpl;
  batch.set(questRef, {
    ...questData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Daily priorities — first N tutorial missions become today's daily
  // missions. Mirrors the shape setDailyMissions writes.
  const today = toDateString(new Date());
  const dailyConfigRef = doc(db, 'users', userId, 'dailyMissions', 'config');
  batch.set(dailyConfigRef, {
    missionIds: missionIds.slice(0, TUTORIAL_DAILY_PRIORITY_COUNT),
    setForDate: today,
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  return { questId: questRef.id, missionIds };
};

/**
 * Phase 1 watcher: if the user has an active tutorial mission tagged with the
 * given step, mark it complete. Called from service functions that perform
 * the underlying real action (mission completion, daily plan submit, daily
 * review submit). Always fire-and-forget — never block the user's action.
 *
 * Cheap path for already-onboarded users: the indexed mission query returns
 * empty quickly when no matching tutorial mission exists.
 *
 * @param {string} userId
 * @param {string} stepKey  one of TUTORIAL_STEPS
 */
export const completeTutorialStepIfActive = async (userId, stepKey) => {
  try {
    const missionsCol = collection(db, 'users', userId, 'missions');
    const q = query(
      missionsCol,
      where('tutorialStep', '==', stepKey),
      where('status', '==', MISSION_STATUS.ACTIVE),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    // Use completeMissionWithRecurrence so the completion cascades through
    // the same flow as a user check-off — updates quest progress, fires
    // achievements, logs activity. Tutorial missions are UNIQUE so the
    // recurrence branch is a no-op, but using the public entry keeps
    // behavior consistent.
    const { completeMissionWithRecurrence } = await import('./missionService');
    await completeMissionWithRecurrence(userId, snap.docs[0].id);
  } catch (error) {
    console.error('Tutorial step auto-complete failed:', error);
  }
};
