// src/services/reviewService.js
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase/config';
import { getUserProfile } from './userService';
import { toDateString } from '../utils/dateHelpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Returns a human-readable task age string for the AI prompt
// e.g. "created today", "created 3 days ago", "created 2 weeks ago"
const getTaskAgeLabel = (createdAt) => {
  if (!createdAt) return null;
  const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  const now = new Date();
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'created today';
  if (diffDays === 1) return 'created yesterday';
  if (diffDays < 7) return `created ${diffDays} days ago`;
  if (diffDays < 14) return 'created about a week ago';
  if (diffDays < 30) return `created ${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return 'created about a month ago';
  return `created ${Math.floor(diffDays / 30)} months ago`;
};

// ─── Encounters ──────────────────────────────────────────────────────────────

/**
 * Fetches all encounters for a given date.
 * @returns {Array} Array of encounter objects with id
 */
export const getEncountersForDate = async (userId, date) => {
  const ref = collection(db, 'users', userId, 'encounters');
  const q = query(ref, where('date', '==', date), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Adds an encounter to the encounters subcollection.
 * @param {string} userId
 * @param {{ title: string, notes: string, date: string }} encounterData
 * @returns {string} The new document ID
 */
export const addEncounter = async (userId, encounterData) => {
  const ref = collection(db, 'users', userId, 'encounters');
  const docRef = await addDoc(ref, {
    title: encounterData.title,
    notes: encounterData.notes || '',
    date: encounterData.date,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Deletes an encounter by document ID.
 */
export const removeEncounter = async (userId, encounterId) => {
  const ref = doc(db, 'users', userId, 'encounters', encounterId);
  await deleteDoc(ref);
};

// ─── Adventure Log ────────────────────────────────────────────────────────────

/**
 * Returns all daily snapshots for the user, ordered by date descending.
 * @returns {Array} Array of snapshot objects with date as key
 */
export const getAllDailySnapshots = async (userId) => {
  const ref = collection(db, 'users', userId, 'dailySnapshots');
  const q = query(ref, orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Returns dates that have activity log entries but no daily snapshot.
 * Used to show placeholder cards in the Adventure Log.
 * @returns {Array} Array of { date, missionCount } objects, sorted by date desc
 */
export const getDatesWithActivity = async (userId) => {
  const logRef = collection(db, 'users', userId, 'activityLog');
  const q = query(logRef, where('type', '==', 'mission_completed'));
  const snap = await getDocs(q);

  // Aggregate mission counts per date
  const dateCounts = {};
  snap.docs.forEach(d => {
    const { date } = d.data();
    if (date) dateCounts[date] = (dateCounts[date] || 0) + 1;
  });

  // Fetch existing snapshots to exclude those dates
  const snapshotRef = collection(db, 'users', userId, 'dailySnapshots');
  const snapshotSnap = await getDocs(snapshotRef);
  const snapshotDates = new Set(snapshotSnap.docs.map(d => d.id));

  // Return only dates without snapshots, sorted descending
  return Object.entries(dateCounts)
    .filter(([date]) => !snapshotDates.has(date))
    .map(([date, missionCount]) => ({ date, missionCount }))
    .sort((a, b) => b.date.localeCompare(a.date));
};

// ─── Snapshot Read / Write Helpers ───────────────────────────────────────────

/**
 * Returns the saved snapshot for a given date, or null if none exists.
 */
export const getDailySnapshot = async (userId, dateString) => {
  const ref = doc(db, 'users', userId, 'dailySnapshots', dateString);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

/**
 * Saves the user's edited story text back to the snapshot doc.
 * Sets userEditedStory so generateDailySnapshot can preserve it on rebuild.
 */
export const updateSnapshotStory = async (userId, dateString, storyText) => {
  const ref = doc(db, 'users', userId, 'dailySnapshots', dateString);
  await updateDoc(ref, {
    userEditedStory: storyText,
    userEditedStoryAt: serverTimestamp(),
  });
};

// ─── Activity Log ─────────────────────────────────────────────────────────────

/**
 * Writes a single event to the activity log.
 * Called from completeMission in missionService.js.
 *
 * @param {string} userId
 * @param {object} missionData - The mission document data (before completion update)
 * @param {object} completionResult - Return value from completeMission:
 *   { xpAwarded, leveledUp, newLevel, skillLeveledUp, skillName, newSkillLevel }
 */
export const logActivityEvent = async (userId, missionData, completionResult) => {
  try {
    const logRef = collection(db, 'users', userId, 'activityLog');
    const today = toDateString(new Date());

    // Look up daily config to determine if this mission is a daily mission.
    // isDailyMission is computed, not stored on mission documents, so we
    // check the config directly rather than trusting missionData.isDailyMission.
    let isDailyMission = false;
    try {
      const configRef = doc(db, 'users', userId, 'dailyMissions', 'config');
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const config = configSnap.data();
        isDailyMission = config.setForDate === today &&
          Array.isArray(config.missionIds) &&
          config.missionIds.includes(missionData.id);
      }
    } catch (configError) {
      // Non-fatal — isDailyMission stays false
      console.warn('Could not read daily config for activity log:', configError);
    }

    await addDoc(logRef, {
      type: 'mission_completed',
      date: today,
      timestamp: serverTimestamp(),

      // Mission context
      missionId: missionData.id,
      missionTitle: missionData.title || 'Untitled Mission',
      missionDescription: missionData.description || null,
      difficulty: missionData.difficulty || 'easy',
      isDailyMission,
      missionCreatedAt: missionData.createdAt || null,
      xpEarned: completionResult.xpAwarded || 0,
      spEarned: missionData.spReward || 0,
      skillName: missionData.skill || null,

      // Quest context
      questId: missionData.questId || null,
      questTitle: missionData.questTitle || null,

      // Level-up events
      leveledUp: completionResult.leveledUp || false,
      newLevel: completionResult.newLevel || null,
      skillLeveledUp: completionResult.skillLeveledUp || false,
      newSkillLevel: completionResult.newSkillLevel || null,
      skillLevelUpName: completionResult.skillName || null,
    });
  } catch (error) {
    // Logging failure should never break the completion flow
    console.error('Error logging activity event:', error);
  }
};

// ─── Daily Snapshot ───────────────────────────────────────────────────────────

/**
 * Builds (or rebuilds) the daily snapshot for a given date.
 * Queries the activity log, aggregates stats, fetches current profile,
 * fetches encounters, generates the AI story, and writes the snapshot document.
 *
 * @param {string} userId
 * @param {string} dateString - 'YYYY-MM-DD', defaults to today
 * @param {string} displayName - Used in the AI story prompt
 * @returns {object} The snapshot data that was written
 */
export const generateDailySnapshot = async (userId, dateString, displayName) => {
  const date = dateString || toDateString(new Date());

  // 1. Fetch all activity log events for this date
  const logRef = collection(db, 'users', userId, 'activityLog');
  const q = query(
    logRef,
    where('date', '==', date),
    where('type', '==', 'mission_completed'),
    orderBy('timestamp', 'asc')
  );
  const snapshot = await getDocs(q);
  const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // 2. Build completed missions list (the rich data fed to the AI)
  const completedMissions = events.map(event => ({
    missionId: event.missionId,
    title: event.missionTitle,
    description: event.missionDescription || null,
    difficulty: event.difficulty,
    isDailyMission: event.isDailyMission,
    skillName: event.skillName || null,
    xpEarned: event.xpEarned || 0,
    spEarned: event.spEarned || 0,
    questTitle: event.questTitle || null,
    taskAge: getTaskAgeLabel(event.missionCreatedAt),
  }));

  // 3. Aggregate stats
  const missionsCompleted = events.length;
  const xpEarned = events.reduce((sum, e) => sum + (e.xpEarned || 0), 0);
  const spEarned = events.reduce((sum, e) => sum + (e.spEarned || 0), 0);

  // Daily missions completed today — read from activity log events
  const dailyMissionsCompleted = events.filter(e => e.isDailyMission).length;

  // For dailyMissionsTotal: read the daily config directly.
  // Total = missions in today's config that were completed today
  //       + missions in today's config that are still active (not yet done).
  // This is flexible — no penalty if life got in the way.
  let dailyMissionsTotal = dailyMissionsCompleted; // fallback: at least as many as completed
  try {
    const configRef = doc(db, 'users', userId, 'dailyMissions', 'config');
    const configSnap = await getDoc(configRef);
    if (configSnap.exists()) {
      const config = configSnap.data();
      if (config.setForDate === date && Array.isArray(config.missionIds)) {
        dailyMissionsTotal = config.missionIds.length;
      }
    }
  } catch (configError) {
    console.warn('Could not read daily config for snapshot:', configError);
  }

  // Skills used today
  const skillMap = {};
  events.forEach(e => {
    if (e.skillName) {
      if (!skillMap[e.skillName]) {
        skillMap[e.skillName] = { name: e.skillName, spEarned: 0, missionsCompleted: 0 };
      }
      skillMap[e.skillName].spEarned += e.spEarned || 0;
      skillMap[e.skillName].missionsCompleted += 1;
    }
  });
  const skillsUsed = Object.values(skillMap);

  // Quests advanced today
  const questMap = {};
  events.forEach(e => {
    if (e.questId) {
      if (!questMap[e.questId]) {
        questMap[e.questId] = {
          questId: e.questId,
          questTitle: e.questTitle || 'Unnamed Quest',
          missionsCompleted: 0,
        };
      }
      questMap[e.questId].missionsCompleted += 1;
    }
  });
  const questsAdvanced = Object.values(questMap);

  // Level-up events
  const levelUps = events
    .filter(e => e.leveledUp && e.newLevel)
    .map(e => ({ newLevel: e.newLevel }));

  const skillLevelUps = events
    .filter(e => e.skillLeveledUp && e.newSkillLevel)
    .map(e => ({ skillName: e.skillLevelUpName, newLevel: e.newSkillLevel }));

  // 4. Current profile state (snapshot at time of review)
  const profile = await getUserProfile(userId);

  // 5. Check for existing user-edited story — preserve it on rebuild
  let existingUserStory = null;
  try {
    const existingSnap = await getDoc(doc(db, 'users', userId, 'dailySnapshots', date));
    if (existingSnap.exists()) {
      existingUserStory = existingSnap.data().userEditedStory ?? null;
    }
  } catch { /* non-fatal */ }

  // 6. Fetch encounters for this date
  let encounters = [];
  try {
    encounters = await getEncountersForDate(userId, date);
  } catch { /* non-fatal — story still generates without encounters */ }

  // 7. Generate the AI story
  const storyData = {
    displayName: displayName || profile?.displayName || 'You',
    completedMissions,
    dailyMissionsCompleted,
    dailyMissionsTotal,
    allDailyMissionsDone: dailyMissionsTotal > 0 && dailyMissionsCompleted === dailyMissionsTotal,
    xpEarned,
    levelUps,
    skillLevelUps,
    skillsUsed,
    questsAdvanced,
    encounters,
  };

  console.log('storyData: ', storyData);

  let aiStory = null;
  let aiStoryGeneratedAt = null;

  if (missionsCompleted > 0) {
    try {
      aiStory = await generateDailyStory(storyData);
      console.log('aiStory: ', aiStory);
      aiStoryGeneratedAt = new Date().toISOString();
    } catch (error) {
      console.error('Error generating daily story:', error);
      console.log('Error generating daily story');
      // Snapshot still saves without story — user can retry
    }
  }

  // 7. Build and write the snapshot document
  const snapshotData = {
    date,
    generatedAt: serverTimestamp(),

    missionsCompleted,
    xpEarned,
    spEarned,

    dailyMissionsCompleted,
    dailyMissionsTotal,
    allDailyMissionsDone: dailyMissionsTotal > 0 && dailyMissionsCompleted === dailyMissionsTotal,

    skillsUsed,
    questsAdvanced,
    questsCompleted: [], // future: detect quest completions from events

    levelUps,
    skillLevelUps,

    levelAtEndOfDay: profile?.level || 1,
    totalXPAtEndOfDay: profile?.totalXP || 0,

    completedMissions, // full list for future use and AI re-generation

    aiStoryGenerated: aiStory !== null,
    aiStory,
    aiStoryGeneratedAt,

    // Preserve user's edited story text across rebuilds
    userEditedStory: existingUserStory ?? null,
  };

  const snapshotRef = doc(db, 'users', userId, 'dailySnapshots', date);
  await setDoc(snapshotRef, snapshotData);

  return snapshotData;
};

// ─── AI Story Generation ──────────────────────────────────────────────────────

/**
 * Calls the Anthropic API to generate a daily chronicle entry.
 * Takes the aggregated snapshot data and returns a story string.
 *
 * @param {object} data - Aggregated day data
 * @returns {string} The generated story text
 */
export const generateDailyStory = async (data) => {
  const {
    displayName,
    completedMissions,
    dailyMissionsCompleted,
    dailyMissionsTotal,
    allDailyMissionsDone,
    xpEarned,
    levelUps,
    skillLevelUps,
    questsAdvanced,
    encounters = [],
  } = data;

  // Build mission list for prompt — task age is the key signal for the AI
  const missionLines = completedMissions.map(m => {
    const parts = [
      `"${m.title}"`,
      m.description ? ` — ${m.description}` : '',
      ` (${m.difficulty}`,
      m.isDailyMission ? ', daily mission' : '',
      m.skillName ? `, ${m.skillName} skill` : '',
      m.questTitle ? `, part of "${m.questTitle}"` : '',
      m.taskAge && m.taskAge !== 'created today' ? `, ${m.taskAge}` : '',
      ')',
    ];
    return parts.join('');
  });

  // Notable events — level ups, skill ups, all dailies done
  const events = [];
  if (levelUps.length > 0) {
    events.push(`Reached level ${levelUps[levelUps.length - 1].newLevel}.`);
  }
  skillLevelUps.forEach(s => {
    events.push(`${s.skillName} skill reached level ${s.newLevel}.`);
  });
  if (allDailyMissionsDone && dailyMissionsTotal > 0) {
    events.push(`Completed all ${dailyMissionsTotal} daily missions.`);
  }

  const difficultyBreakdown = completedMissions.reduce((acc, m) => {
    acc[m.difficulty] = (acc[m.difficulty] || 0) + 1;
    return acc;
  }, {});
  const hardCount = difficultyBreakdown.hard || 0;

  const encounterLines = encounters.map(e =>
    e.notes ? `- "${e.title}" — ${e.notes}` : `- "${e.title}"`
  );

  const userPrompt = `
Here is the raw data for today's chronicle entry:

Missions completed (${completedMissions.length} total, ${hardCount} hard):
${missionLines.join('\n')}

Daily missions: ${dailyMissionsCompleted} of ${dailyMissionsTotal} completed
${events.length > 0 ? `\nNotable:\n${events.join('\n')}` : ''}
${encounterLines.length > 0 ? `\nUnexpected encounters:\n${encounterLines.join('\n')}` : ''}

Write the entry.`.trim();

  const systemPrompt = `You write the daily chronicle for a mom whose life is framed as an RPG. Her tasks are "missions," her projects are "quests," her home is her base. You are recording her day for posterity — not informing her of what happened, because she was there.

Your job is to find what was actually interesting about today and say something true about it. One or two things, not everything. Let the rest stay implied. Use language and metaphor to do the heavy lifting — a good image is worth three explanatory sentences.

Write in a voice inspired by Terry Pratchett: warm, a little wry, takes mundane things completely seriously, finds the human truth in small moments. Whimsy is welcome. Embellishment is welcome. If a line is clever but not true, cut it.

Vary how you open — sometimes lead with the task itself, sometimes the feeling around it, sometimes an observation about time or habit or what things cost. On the other hand, identify real triumphs and give those the weight they deserve.

If there were unexpected encounters, weave them in naturally — they are the texture of the day, not a footnote. An interruption that swallowed an afternoon is more interesting than a mission that went smoothly.

Rules:
- 3–5 sentences
- Second person ("You...")
- No exclamation points
- Never use the word "adventurer"
- If nothing dramatic happened, say something true about what ordinary days are actually for
- Under 120 words`;

console.log('System prompt: ', systemPrompt);

  const response = await fetch('/api/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    }),
  });

  console.log('Response: ', response);

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const result = await response.json();
  const textBlock = result.content?.find(block => block.type === 'text');
  if (!textBlock) throw new Error('No text in API response');

  return textBlock.text.trim();
};