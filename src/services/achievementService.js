// src/services/achievementService.js
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase/config';
import ACHIEVEMENTS, { ACHIEVEMENT_MAP } from '../data/achievementDefinitions';
import { toDateString } from '../utils/dateHelpers';

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
  snap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  return map;
};

/**
 * Returns all achievements (built-in and custom) awarded on a specific date.
 * Merges Firestore award docs with static definitions to include display data.
 */
export const getAchievementsAwardedOnDate = async (userId, date) => {
  const ref = getAchievementsRef(userId);
  const snap = await getDocs(query(ref, where('awardedDate', '==', date)));
  return snap.docs.map(d => {
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
    if (doc.isCustom) custom.push({ ...doc, isAwarded: true });
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
 * Creates and immediately awards a custom achievement (a moment capture).
 * @returns {object} The new achievement doc with its Firestore id
 */
export const createCustomAchievement = async (userId, { name, description, badgeColor, badgeIcon }) => {
  const today = toDateString(new Date());
  const docRef = await addDoc(getAchievementsRef(userId), {
    name,
    description: description || '',
    badgeColor,
    badgeIcon,
    isCustom: true,
    awardedDate: today,
    awardedAt: serverTimestamp(),
  });
  return {
    id: docRef.id,
    name,
    description: description || '',
    badgeColor,
    badgeIcon,
    isCustom: true,
    awardedDate: today,
    isAwarded: true,
  };
};

// ─── Check Helpers (pure functions over already-fetched data) ─────────────────

const countTotalMissions = (activityDocs) =>
  activityDocs.filter(d => d.type === 'mission_completed').length;

const countHardMissions = (activityDocs) =>
  activityDocs.filter(d => d.type === 'mission_completed' && d.difficulty === 'hard').length;

const countMissionsOnDate = (activityDocs, date) =>
  activityDocs.filter(d => d.type === 'mission_completed' && d.date === date).length;

const allDailyMissionsComplete = (activityDocs, date) => {
  const dayEntries = activityDocs.filter(d => d.type === 'mission_completed' && d.date === date);
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
    if (d.type !== 'mission_completed') return false;
    const ts = d.timestamp?.toDate ? d.timestamp.toDate() : null;
    if (!ts) return false;
    const hour = ts.getHours();
    return hour >= 0 && hour < 4;
  }).length;

const countEarlyMissions = (activityDocs) =>
  activityDocs.filter(d => {
    if (d.type !== 'mission_completed') return false;
    const ts = d.timestamp?.toDate ? d.timestamp.toDate() : null;
    if (!ts) return false;
    return ts.getHours() < 7;
  }).length;

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Checks all built-in achievements and awards any that are newly earned.
 *
 * @param {string} userId
 * @param {object} context  — { date?: string, streak?: number, questCompleted?: boolean }
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
      const snap = await getDocs(query(ref, where('type', '==', 'mission_completed')));
      activityDocs = snap.docs.map(d => d.data());
      return activityDocs;
    };

    const getQuestCount = async () => {
      if (questCount !== null) return questCount;
      const ref = collection(db, 'users', userId, 'quests');
      const snap = await getDocs(query(ref, where('status', '==', 'completed')));
      questCount = snap.docs.length;
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
        case 'streak': {
          const streak = context.streak ?? 0;
          passed = streak >= def.threshold;
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
