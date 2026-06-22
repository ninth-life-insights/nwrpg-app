// src/services/achievementService.js
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDocs,
  getCountFromServer,
  query,
  where,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

// Read caps. The activityLog scan inflates with every mission completion, so
// a long-time user can rack up thousands of entries. Achievement thresholds
// top out well below this cap, so limiting to 5000 keeps the achievement
// math correct for any realistic user.
const MAX_ACTIVITY_DOCS = 5000;
import { db } from './firebase/config';
import ACHIEVEMENTS, { ACHIEVEMENT_MAP } from '../data/achievementDefinitions';
import { toDateString } from '../utils/dateHelpers';
import { QUEST_TYPE } from '../types/Quests';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getAchievementsRef = (userId) =>
  collection(db, 'users', userId, 'achievements');

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns a Map of achievementId → awarded doc data for all awarded achievements.
 */
export const getAwardedAchievements = async (userId) => {
  const snap = await getDocs(getAchievementsRef(userId));
  const map = new Map();
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.status !== 'deleted') {
      map.set(d.id, { id: d.id, ...data });
    }
  });
  return map;
};

/**
 * Returns all achievements (built-in and custom) awarded on a specific date.
 * Merges Firestore award docs with static definitions to include display data.
 */
export const getAchievementsAwardedOnDate = async (userId, date) => {
  const ref = getAchievementsRef(userId);
  const snap = await getDocs(query(ref, where('awardedDate', '==', date)));
  return snap.docs.filter(d => d.data().status !== 'deleted').map(d => {
    const data = d.data();
    if (data.isCustom) {
      return { id: d.id, ...data, isAwarded: true };
    }
    const def = ACHIEVEMENT_MAP[d.id];
    if (!def) return null;
    return { ...def, awardedDate: data.awardedDate, isAwarded: true };
  }).filter(Boolean);
};

/**
 * Returns the merged library: built-in achievements with awarded status, plus custom ones.
 * Built-in: awarded first (full color), then locked.
 * Custom: all awarded, in a separate array.
 */
export const getMergedAchievementLibrary = async (userId) => {
  const awardedMap = await getAwardedAchievements(userId);

  const builtIn = ACHIEVEMENTS.map(def => ({
    ...def,
    isAwarded: awardedMap.has(def.id),
    awardedDate: awardedMap.get(def.id)?.awardedDate || null,
    awardedAt: awardedMap.get(def.id)?.awardedAt || null,
  }));

  // Sort: awarded first, then alphabetically by name
  builtIn.sort((a, b) => {
    if (a.isAwarded && !b.isAwarded) return -1;
    if (!a.isAwarded && b.isAwarded) return 1;
    return a.name.localeCompare(b.name);
  });

  const custom = [];
  awardedMap.forEach(doc => {
    if (doc.isCustom && doc.status !== 'deleted') {
      custom.push({ ...doc, isAwarded: !doc.isPending });
    }
  });
  custom.sort((a, b) => (b.awardedDate || '').localeCompare(a.awardedDate || ''));

  return { builtIn, custom, totalBuiltIn: ACHIEVEMENTS.length, awardedBuiltInCount: builtIn.filter(a => a.isAwarded).length };
};

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Awards a built-in achievement. Uses setDoc so it's idempotent.
 */
const awardBuiltInAchievement = async (userId, definition) => {
  const ref = doc(db, 'users', userId, 'achievements', definition.id);
  await setDoc(ref, {
    awardedDate: toDateString(new Date()),
    awardedAt: serverTimestamp(),
    isCustom: false,
  }, { merge: true });
};

/**
 * Creates a custom achievement. If questId is provided, saved as pending (not yet awarded).
 * If no questId, awarded immediately (standard "Record a Win" flow).
 * @returns {object} The new achievement doc with its Firestore id
 */
export const createCustomAchievement = async (userId, { name, description, badgeColor, badgeSymbol, questId = null }) => {
  const isPending = Boolean(questId);
  const today = isPending ? null : toDateString(new Date());
  const docRef = await addDoc(getAchievementsRef(userId), {
    name,
    description: description || '',
    badgeColor,
    badgeSymbol,
    isCustom: true,
    isPending,
    questId,
    awardedDate: today,
    awardedAt: isPending ? null : serverTimestamp(),
  });
  return {
    id: docRef.id,
    name,
    description: description || '',
    badgeColor,
    badgeSymbol,
    isCustom: true,
    isPending,
    questId,
    awardedDate: today,
    isAwarded: !isPending,
  };
};

/**
 * Awards a previously pending quest achievement.
 */
export const awardPendingAchievement = async (userId, achievementId) => {
  const ref = doc(db, 'users', userId, 'achievements', achievementId);
  await updateDoc(ref, {
    isPending: false,
    awardedDate: toDateString(new Date()),
    awardedAt: serverTimestamp(),
  });
};

/**
 * Updates an existing custom achievement's display fields.
 */
export const updateCustomAchievement = async (userId, achievementId, { name, description, badgeColor, badgeSymbol }) => {
  const ref = doc(db, 'users', userId, 'achievements', achievementId);
  await updateDoc(ref, { name, description, badgeColor, badgeSymbol, updatedAt: serverTimestamp() });
};

/**
 * Soft-deletes a custom achievement.
 */
export const deleteCustomAchievement = async (userId, achievementId) => {
  const ref = doc(db, 'users', userId, 'achievements', achievementId);
  await updateDoc(ref, { status: 'deleted', deletedAt: serverTimestamp() });
};

/**
 * Resets an awarded quest achievement back to pending (e.g. quest re-opened).
 */
export const unawardPendingAchievement = async (userId, achievementId) => {
  const ref = doc(db, 'users', userId, 'achievements', achievementId);
  await updateDoc(ref, {
    isPending: true,
    awardedDate: null,
    awardedAt: null,
  });
};

// ─── Check Helpers (pure functions over already-fetched data) ─────────────────

// Tutorial mission completions are excluded from all count-based achievement
// checks — they shouldn't pad milestones like "complete 5 missions in a day"
// or "complete your first mission." The only achievement that depends on the
// tutorial is training_grounds_complete, which keys off the quest itself.
const isCountableMissionEvent = (d) =>
  d.type === 'mission_completed' && !d.isTutorial;

const countTotalMissions = (activityDocs) =>
  activityDocs.filter(isCountableMissionEvent).length;

const countHardMissions = (activityDocs) =>
  activityDocs.filter(d => isCountableMissionEvent(d) && d.difficulty === 'hard').length;

const countMissionsOnDate = (activityDocs, date) =>
  activityDocs.filter(d => isCountableMissionEvent(d) && d.date === date).length;

const allDailyMissionsComplete = (activityDocs, date) => {
  const dayEntries = activityDocs.filter(d => isCountableMissionEvent(d) && d.date === date);
  const dailyEntries = dayEntries.filter(d => d.isDailyMission === true);
  // Need at least one daily mission completed, and all completed missions that were daily
  // We detect "full sweep" by checking if dailyMissionsTotal was set and matched
  // Use dailyMissionsTotal from any entry if available
  const entryWithTotal = dayEntries.find(d => d.dailyMissionsTotal != null);
  if (entryWithTotal) {
    return dailyEntries.length >= entryWithTotal.dailyMissionsTotal && entryWithTotal.dailyMissionsTotal > 0;
  }
  // Fallback: at least one daily mission completed
  return dailyEntries.length > 0;
};

const countMidnightMissions = (activityDocs) =>
  activityDocs.filter(d => {
    if (!isCountableMissionEvent(d)) return false;
    const ts = d.timestamp?.toDate ? d.timestamp.toDate() : null;
    if (!ts) return false;
    const hour = ts.getHours();
    return hour >= 0 && hour < 4;
  }).length;

const countEarlyMissions = (activityDocs) =>
  activityDocs.filter(d => {
    if (!isCountableMissionEvent(d)) return false;
    const ts = d.timestamp?.toDate ? d.timestamp.toDate() : null;
    if (!ts) return false;
    return ts.getHours() < 7;
  }).length;

const countSkillsAtLevel = (skills, minLevel) =>
  Object.values(skills).filter(s => (s.level || 1) >= minLevel).length;

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Checks all built-in achievements and awards any that are newly earned.
 *
 * @param {string} userId
 * @param {object} context  — { date?: string, difficulty?: string, skills?: object, questCompleted?: boolean }
 * @returns {{ newlyAwarded: object[] }}  — array of achievement definition objects
 */
export const checkAndAwardAchievements = async (userId, context = {}) => {
  try {
    const today = context.date || toDateString(new Date());

    // 1. Fetch already-awarded achievement IDs (small collection, cheap)
    const awardedMap = await getAwardedAchievements(userId);

    // 2. Find built-in achievements not yet awarded
    const unawardedDefs = ACHIEVEMENTS.filter(def => !awardedMap.has(def.id));
    if (unawardedDefs.length === 0) return { newlyAwarded: [] };

    // 3. Determine which check types are needed
    const neededTypes = new Set(unawardedDefs.map(d => d.checkType));

    // 4. Fetch data lazily — only what's needed
    let activityDocs = null;
    let questCount = null;

    const getActivityDocs = async () => {
      if (activityDocs !== null) return activityDocs;
      const ref = collection(db, 'users', userId, 'activityLog');
      const snap = await getDocs(query(
        ref,
        where('type', '==', 'mission_completed'),
        limit(MAX_ACTIVITY_DOCS)
      ));
      activityDocs = snap.docs.map(d => d.data());
      return activityDocs;
    };

    const getQuestCount = async () => {
      if (questCount !== null) return questCount;
      // getCountFromServer doesn't pull the docs — single read instead of N.
      // Exclude the tutorial quest from the count so finishing onboarding
      // doesn't earn the "Questing 101" achievement. Two count queries beats
      // fetching docs to filter client-side.
      const ref = collection(db, 'users', userId, 'quests');
      const [allSnap, tutorialSnap] = await Promise.all([
        getCountFromServer(query(ref, where('status', '==', 'completed'))),
        getCountFromServer(query(
          ref,
          where('status', '==', 'completed'),
          where('type', '==', QUEST_TYPE.TUTORIAL),
        )),
      ]);
      questCount = allSnap.data().count - tutorialSnap.data().count;
      return questCount;
    };

    // 5. Evaluate each unawarded achievement
    const newlyAwarded = [];

    for (const def of unawardedDefs) {
      let passed = false;

      switch (def.checkType) {
        case 'total_missions': {
          const docs = await getActivityDocs();
          passed = countTotalMissions(docs) >= def.threshold;
          break;
        }
        case 'hard_missions': {
          const docs = await getActivityDocs();
          passed = countHardMissions(docs) >= def.threshold;
          break;
        }
        case 'missions_in_day': {
          const docs = await getActivityDocs();
          passed = countMissionsOnDate(docs, today) >= def.threshold;
          break;
        }
        case 'all_daily_complete': {
          const docs = await getActivityDocs();
          passed = allDailyMissionsComplete(docs, today);
          break;
        }
        case 'total_quests': {
          const count = await getQuestCount();
          passed = count >= def.threshold;
          break;
        }
        case 'midnight_missions': {
          const docs = await getActivityDocs();
          passed = countMidnightMissions(docs) >= def.threshold;
          break;
        }
        case 'early_missions': {
          const docs = await getActivityDocs();
          passed = countEarlyMissions(docs) >= def.threshold;
          break;
        }
        case 'skill_level_5': {
          const skills = context.skills || {};
          passed = countSkillsAtLevel(skills, def.threshold) >= 1;
          break;
        }
        case 'skill_3_at_5': {
          const skills = context.skills || {};
          passed = countSkillsAtLevel(skills, def.threshold) >= 3;
          break;
        }
        case 'tutorial_quest_completed': {
          // Fires when updateQuestProgress auto-completes a tutorial-type quest.
          // Caller passes { questCompleted: true, quest } in context.
          passed = context.questCompleted === true &&
                   context.quest?.type === QUEST_TYPE.TUTORIAL;
          break;
        }
        default:
          break;
      }

      if (passed) {
        await awardBuiltInAchievement(userId, def);
        newlyAwarded.push(def);
      }
    }

    return { newlyAwarded };
  } catch (error) {
    console.error('[achievements] checkAndAwardAchievements threw:', error);
    return { newlyAwarded: [] };
  }
};
