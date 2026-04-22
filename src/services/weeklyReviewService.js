// src/services/weeklyReviewService.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase/config';
import { getUserProfile } from './userService';
import { toDateString } from '../utils/dateHelpers';
import { withTimeout, AI_TIMEOUT_MS } from '../utils/fetchWithTimeout';
import dayjs from 'dayjs';

// ─── Weekly Snapshot CRUD ─────────────────────────────────────────────────────

/**
 * Returns the saved weekly snapshot for a given week start date, or null.
 * @param {string} userId
 * @param {string} weekStartDate - 'YYYY-MM-DD'
 */
export const getWeeklySnapshot = async (userId, weekStartDate) => {
  try {
    const ref = doc(db, 'users', userId, 'weeklySnapshots', weekStartDate);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error('Error fetching weekly snapshot:', error);
    throw error;
  }
};

/**
 * Returns all weekly snapshots for the user, ordered by date descending.
 */
export const getAllWeeklySnapshots = async (userId) => {
  try {
    const ref = collection(db, 'users', userId, 'weeklySnapshots');
    const q = query(ref, orderBy('weekStartDate', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching weekly snapshots:', error);
    throw error;
  }
};

/**
 * Saves the user's edited story text back to the weekly snapshot.
 */
export const updateWeeklySnapshotStory = async (userId, weekStartDate, storyText) => {
  try {
    const ref = doc(db, 'users', userId, 'weeklySnapshots', weekStartDate);
    await updateDoc(ref, {
      userEditedStory: storyText,
      userEditedStoryAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating weekly snapshot story:', error);
    throw error;
  }
};

// ─── Snapshot Aggregation ─────────────────────────────────────────────────────

/**
 * Fetches all daily snapshots between startDate and endDate (inclusive).
 * Used only for supplementary data (dailyMissionsTotal) that isn't in activityLog.
 */
const getDailySnapshotsForRange = async (userId, startDate, endDate) => {
  try {
    const ref = collection(db, 'users', userId, 'dailySnapshots');
    const q = query(
      ref,
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching daily snapshots for range:', error);
    throw error;
  }
};

/**
 * Fetches all mission_completed activityLog events for a given week.
 * Loads all events and filters in-memory to avoid requiring a composite index.
 */
const getActivityEventsForWeek = async (userId, startDate, endDate) => {
  try {
    const logRef = collection(db, 'users', userId, 'activityLog');
    const q = query(logRef, where('type', '==', 'mission_completed'));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(e => e.date >= startDate && e.date <= endDate);
  } catch (error) {
    console.error('Error fetching activity events for week:', error);
    throw error;
  }
};

/**
 * Aggregates activityLog events into weekly stats.
 * This is the primary source — it captures all completions regardless of
 * whether the user did a daily review.
 */
const aggregateActivityEvents = (events) => {
  let missionsCompleted = 0;
  let xpEarned = 0;
  let spEarned = 0;
  let dailyMissionsCompleted = 0;

  const skillMap = {};
  const questMap = {};
  const levelUps = [];
  const skillLevelUps = [];
  const dayMap = {};

  events.forEach(e => {
    missionsCompleted++;
    xpEarned += e.xpEarned || 0;
    spEarned += e.spEarned || 0;
    if (e.isDailyMission) dailyMissionsCompleted++;
    if (e.date) dayMap[e.date] = (dayMap[e.date] || 0) + 1;

    if (e.skillName) {
      if (!skillMap[e.skillName]) {
        skillMap[e.skillName] = { name: e.skillName, spEarned: 0, missionsCompleted: 0 };
      }
      skillMap[e.skillName].spEarned += e.spEarned || 0;
      skillMap[e.skillName].missionsCompleted++;
    }

    if (e.questId) {
      if (!questMap[e.questId]) {
        questMap[e.questId] = {
          questId: e.questId,
          questTitle: e.questTitle || 'Unnamed Quest',
          missionsCompleted: 0,
        };
      }
      questMap[e.questId].missionsCompleted++;
    }

    if (e.leveledUp && e.newLevel) levelUps.push({ newLevel: e.newLevel });
    if (e.skillLeveledUp && e.newSkillLevel) {
      skillLevelUps.push({ skillName: e.skillLevelUpName, newLevel: e.newSkillLevel });
    }
  });

  let bestDay = null;
  Object.entries(dayMap).forEach(([date, count]) => {
    if (!bestDay || count > bestDay.missionsCompleted) {
      bestDay = { date, missionsCompleted: count };
    }
  });

  return {
    missionsCompleted,
    xpEarned,
    spEarned,
    dailyMissionsCompleted,
    daysWithActivity: Object.keys(dayMap).length,
    bestDay,
    skillsUsed: Object.values(skillMap).sort((a, b) => b.missionsCompleted - a.missionsCompleted),
    questsAdvanced: Object.values(questMap).sort((a, b) => b.missionsCompleted - a.missionsCompleted),
    levelUps,
    skillLevelUps,
  };
};

// ─── Weekly Snapshot Generation ───────────────────────────────────────────────

/**
 * Builds (or rebuilds) the weekly snapshot for a given week.
 * Aggregates all daily snapshots in the range, generates an AI story,
 * and writes the snapshot document.
 *
 * @param {string} userId
 * @param {string} weekStartDate - 'YYYY-MM-DD'
 * @param {string} weekEndDate - 'YYYY-MM-DD'
 * @param {string} displayName
 * @param {{ forceNewStory?: boolean }} options
 * @returns {object} The snapshot data that was written
 */
export const generateWeeklySnapshot = async (
  userId,
  weekStartDate,
  weekEndDate,
  displayName,
  { forceNewStory = false } = {}
) => {
  try {
    // 1. Fetch activity log events for the week (primary stats source —
    //    captures all completions even if no daily review was done)
    const activityEvents = await getActivityEventsForWeek(userId, weekStartDate, weekEndDate);

    // 2. Aggregate stats from activityLog
    const aggregated = aggregateActivityEvents(activityEvents);

    // 3. Fetch daily snapshots for supplementary data (dailyMissionsTotal)
    //    only needed for the daily mission completion rate calculation
    const dailySnapshots = await getDailySnapshotsForRange(userId, weekStartDate, weekEndDate);
    const dailySnapshotDates = dailySnapshots.map(s => s.date);
    const dailyMissionsTotal = dailySnapshots.reduce((sum, s) => sum + (s.dailyMissionsTotal || 0), 0);

    // 4. Current profile state
    const profile = await getUserProfile(userId);

    // 5. Check for existing weekly snapshot — preserve user-edited story
    let existingUserStory = null;
    let existingAiStory = null;
    let existingAiStoryGeneratedAt = null;
    try {
      const existingRef = doc(db, 'users', userId, 'weeklySnapshots', weekStartDate);
      const existingSnap = await getDoc(existingRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data();
        existingUserStory = existingData.userEditedStory ?? null;
        existingAiStory = existingData.aiStory ?? null;
        existingAiStoryGeneratedAt = existingData.aiStoryGeneratedAt ?? null;
      }
    } catch { /* non-fatal */ }

    // 6. Generate AI story
    let aiStory = (!forceNewStory && existingAiStory) ? existingAiStory : null;
    let aiStoryGeneratedAt = (!forceNewStory && existingAiStory) ? existingAiStoryGeneratedAt : null;

    const storyData = {
      displayName: displayName || profile?.displayName || 'You',
      weekStartDate,
      weekEndDate,
      dailySnapshots,
      ...aggregated,
    };

    if (aggregated.missionsCompleted > 0 && (forceNewStory || !existingAiStory)) {
      try {
        aiStory = await withTimeout(generateWeeklyStory(storyData), AI_TIMEOUT_MS);
        aiStoryGeneratedAt = new Date().toISOString();
      } catch (error) {
        console.error('Error generating weekly story:', error);
        // Snapshot still saves without story — user can retry
      }
    }

    // 7. Build and write the snapshot document
    const snapshotData = {
      weekStartDate,
      weekEndDate,
      generatedAt: serverTimestamp(),

      missionsCompleted: aggregated.missionsCompleted,
      xpEarned: aggregated.xpEarned,
      spEarned: aggregated.spEarned,
      dailyMissionsCompleted: aggregated.dailyMissionsCompleted,
      dailyMissionsTotal,
      bestDay: aggregated.bestDay,

      skillsUsed: aggregated.skillsUsed,
      questsAdvanced: aggregated.questsAdvanced,
      levelUps: aggregated.levelUps,
      skillLevelUps: aggregated.skillLevelUps,

      levelAtEndOfWeek: profile?.level || 1,
      totalXPAtEndOfWeek: profile?.totalXP || 0,

      dailySnapshotDates,
      daysWithActivity: aggregated.daysWithActivity,

      aiStoryGenerated: aiStory !== null,
      aiStory,
      aiStoryGeneratedAt,
      userEditedStory: existingUserStory ?? null,
    };

    const snapshotRef = doc(db, 'users', userId, 'weeklySnapshots', weekStartDate);
    await setDoc(snapshotRef, snapshotData);

    return snapshotData;
  } catch (error) {
    console.error('Error generating weekly snapshot:', error);
    throw error;
  }
};

// ─── AI Weekly Story Generation ───────────────────────────────────────────────

/**
 * Calls the Anthropic API to generate a weekly chronicle entry.
 * @param {object} data - Aggregated week data
 * @returns {string} The generated story text
 */
export const generateWeeklyStory = async (data) => {
  try {
    const {
      displayName,
      weekStartDate,
      weekEndDate,
      dailySnapshots,
      missionsCompleted,
      xpEarned,
      dailyMissionsCompleted,
      dailyMissionsTotal,
      bestDay,
      skillsUsed,
      questsAdvanced,
      levelUps,
      skillLevelUps,
    } = data;

    const weekRange = `${dayjs(weekStartDate).format('MMM D')} – ${dayjs(weekEndDate).format('MMM D')}`;
    const daysActive = dailySnapshots.filter(s => (s.missionsCompleted || 0) > 0).length;

    const skillLines = skillsUsed.slice(0, 5).map(s =>
      `- ${s.name}: ${s.missionsCompleted} mission${s.missionsCompleted !== 1 ? 's' : ''} (${s.spEarned} SP)`
    );

    const questLines = questsAdvanced.map(q =>
      `- "${q.questTitle}": ${q.missionsCompleted} mission${q.missionsCompleted !== 1 ? 's' : ''} completed`
    );

    const notableEvents = [];
    if (levelUps.length > 0) {
      notableEvents.push(`Reached level ${levelUps[levelUps.length - 1].newLevel}.`);
    }
    skillLevelUps.forEach(s => {
      notableEvents.push(`${s.skillName} skill reached level ${s.newLevel}.`);
    });

    const dailyMissionRate = dailyMissionsTotal > 0
      ? Math.round((dailyMissionsCompleted / dailyMissionsTotal) * 100)
      : null;

    const bestDayLine = bestDay
      ? `Best day: ${dayjs(bestDay.date).format('dddd, MMM D')} (${bestDay.missionsCompleted} missions)`
      : null;

    const userPrompt = `
Week of ${weekRange}:

${displayName} was active ${daysActive} of 7 days.
Total missions completed: ${missionsCompleted}
Total XP earned: ${xpEarned}
${dailyMissionRate !== null ? `Daily mission completion rate: ${dailyMissionRate}%` : ''}
${bestDayLine ? bestDayLine : ''}

${skillLines.length > 0 ? `Skills practiced:\n${skillLines.join('\n')}` : ''}

${questLines.length > 0 ? `Quests advanced:\n${questLines.join('\n')}` : ''}

${notableEvents.length > 0 ? `Notable:\n${notableEvents.join('\n')}` : ''}

Write the weekly chronicle entry.`.trim();

    const systemPrompt = `You write the weekly chronicle for a mom whose life is framed as an RPG. Her tasks are "missions," her projects are "quests," her home is her base. You are recording her week — the arc of it, not a list of what happened.

Your job is to find the shape of the week. Was it steady? Scattered? Did something build? Did she show up for one thing consistently while letting another slide? Say that. Let the details imply the rest.

Write in a voice inspired by Terry Pratchett: warm, a little wry, takes mundane things completely seriously, finds the human truth in small moments. A week of ordinary effort deserves the same serious attention as a dramatic one.

Rules:
- 4–6 sentences
- Second person ("You...")
- No exclamation points
- Never use the word "adventurer"
- Focus on the week's character, not a recap of individual days
- Under 150 words`;

    const response = await fetch('/api/anthropic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const result = await response.json();
    const textBlock = result.content?.find(block => block.type === 'text');
    if (!textBlock) throw new Error('No text in API response');

    return textBlock.text.trim();
  } catch (error) {
    console.error('Error generating weekly story:', error);
    throw error;
  }
};

// ─── Expiring Missions ────────────────────────────────────────────────────────

/**
 * Returns active missions that are already expired or expiring within `daysAhead`.
 * @param {string} userId
 * @param {number} daysAhead - How many days ahead to look for expiring missions (default 14)
 * @returns {{ expired: Mission[], expiringSoon: Mission[] }}
 */
export const getExpiringMissions = async (userId, daysAhead = 14) => {
  try {
    const today = toDateString(new Date());
    const cutoff = dayjs().add(daysAhead, 'day').format('YYYY-MM-DD');

    const ref = collection(db, 'users', userId, 'missions');
    const q = query(
      ref,
      where('status', '==', 'active'),
      where('expiryDate', '>', ''),
      orderBy('expiryDate', 'asc')
    );
    const snap = await getDocs(q);
    const missions = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => m.expiryDate && m.expiryDate <= cutoff);

    return {
      expired: missions.filter(m => m.expiryDate < today),
      expiringSoon: missions.filter(m => m.expiryDate >= today),
    };
  } catch (error) {
    console.error('Error fetching expiring missions:', error);
    throw error;
  }
};

/**
 * Updates the expiry date on a mission (used to renew from the expiration step).
 */
export const renewMissionExpiry = async (userId, missionId, newExpiryDate) => {
  try {
    const ref = doc(db, 'users', userId, 'missions', missionId);
    await updateDoc(ref, {
      expiryDate: newExpiryDate,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error renewing mission expiry:', error);
    throw error;
  }
};

// ─── Quest Activity This Week ─────────────────────────────────────────────────

/**
 * Returns a map of questId → missions completed this week, built from
 * the activity log for the given date range.
 * @param {string} userId
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate - 'YYYY-MM-DD'
 * @returns {Object} { [questId]: { questTitle, missionsCompleted, missionTitles[] } }
 */
export const getQuestActivityForWeek = async (userId, startDate, endDate) => {
  try {
    const logRef = collection(db, 'users', userId, 'activityLog');
    const q = query(
      logRef,
      where('type', '==', 'mission_completed'),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const snap = await getDocs(q);

    const questMap = {};
    snap.docs.forEach(d => {
      const event = d.data();
      if (!event.questId) return;
      if (!questMap[event.questId]) {
        questMap[event.questId] = {
          questId: event.questId,
          questTitle: event.questTitle || 'Unnamed Quest',
          missionsCompleted: 0,
          missionTitles: [],
        };
      }
      questMap[event.questId].missionsCompleted += 1;
      questMap[event.questId].missionTitles.push(event.missionTitle || '');
    });

    return questMap;
  } catch (error) {
    console.error('Error fetching quest activity for week:', error);
    throw error;
  }
};
