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
import { withTimeout, AI_TIMEOUT_MS } from '../utils/fetchWithTimeout';
import dayjs from 'dayjs';

// ─── Read helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the weekly snapshot for the given weekStart date string, or null.
 * @param {string} userId
 * @param {string} weekStart - 'YYYY-MM-DD' (the week-start date = document ID)
 */
export const getWeeklySnapshot = async (userId, weekStart) => {
  try {
    const ref = doc(db, 'users', userId, 'weeklySnapshots', weekStart);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error('Error fetching weekly snapshot:', error);
    throw error;
  }
};

/**
 * Returns all weekly snapshots for the user, ordered by weekStart descending.
 * @returns {Array}
 */
export const getAllWeeklySnapshots = async (userId) => {
  try {
    const ref = collection(db, 'users', userId, 'weeklySnapshots');
    const q = query(ref, orderBy('weekStart', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching weekly snapshots:', error);
    throw error;
  }
};

// ─── Snapshot generation ──────────────────────────────────────────────────────

/**
 * Builds (or rebuilds) the weekly snapshot for the given week range.
 * Queries the activityLog for all mission_completed events in the range,
 * then enriches with dailySnapshot data for per-day context.
 *
 * @param {string} userId
 * @param {string} weekStart - 'YYYY-MM-DD'
 * @param {string} weekEnd   - 'YYYY-MM-DD'
 * @param {string} displayName
 * @param {{ forceNewStory?: boolean }} options
 * @returns {object} The snapshot data written to Firestore
 */
export const generateWeeklySnapshot = async (
  userId,
  weekStart,
  weekEnd,
  displayName,
  { forceNewStory = false } = {}
) => {
  try {
    // 1. Fetch all activity log events in the date range
    const logRef = collection(db, 'users', userId, 'activityLog');
    const q = query(
      logRef,
      where('date', '>=', weekStart),
      where('date', '<=', weekEnd),
      where('type', '==', 'mission_completed'),
      orderBy('date', 'asc'),
      orderBy('timestamp', 'asc')
    );
    const logSnap = await getDocs(q);
    const events = logSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2. Fetch all daily snapshots in range for per-day context + level info
    const snapshotRef = collection(db, 'users', userId, 'dailySnapshots');
    const sqQuery = query(
      snapshotRef,
      where('date', '>=', weekStart),
      where('date', '<=', weekEnd),
      orderBy('date', 'asc')
    );
    const snapDocs = await getDocs(sqQuery);
    const dailySnapshots = snapDocs.docs.map(d => ({ id: d.id, ...d.data() }));
    const snapshotsByDate = Object.fromEntries(dailySnapshots.map(s => [s.date, s]));

    // 3. Build per-day breakdown (7 days)
    const dailyBreakdown = [];
    let cur = dayjs(weekStart);
    const end = dayjs(weekEnd);
    while (!cur.isAfter(end, 'day')) {
      const dateStr = cur.format('YYYY-MM-DD');
      const dayEvents = events.filter(e => e.date === dateStr);
      const snap = snapshotsByDate[dateStr];
      dailyBreakdown.push({
        date: dateStr,
        missionsCompleted: dayEvents.length,
        xpEarned: dayEvents.reduce((s, e) => s + (e.xpEarned || 0), 0),
        hasDailyReview: !!snap,
      });
      cur = cur.add(1, 'day');
    }

    // 4. Aggregate totals from activity log (source of truth)
    const totalMissionsCompleted = events.length;
    const totalXpEarned = events.reduce((s, e) => s + (e.xpEarned || 0), 0);
    const totalSpEarned = events.reduce((s, e) => s + (e.spEarned || 0), 0);

    // Daily mission counts — sum from daily snapshots (more accurate than activity log)
    const dailyMissionsCompletedCount = dailySnapshots.reduce(
      (s, d) => s + (d.dailyMissionsCompleted || 0), 0
    );
    const dailyMissionsTotalCount = dailySnapshots.reduce(
      (s, d) => s + (d.dailyMissionsTotal || 0), 0
    );

    // 5. Aggregate skill usage across all events
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

    // 6. Quests advanced
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

    // 7. Level-up and skill-up events
    const levelUps = events
      .filter(e => e.leveledUp && e.newLevel)
      .map(e => ({ newLevel: e.newLevel }));

    const skillLevelUps = events
      .filter(e => e.skillLeveledUp && e.newSkillLevel)
      .map(e => ({ skillName: e.skillLevelUpName, newLevel: e.newSkillLevel }));

    // 8. Profile snapshot
    const profile = await getUserProfile(userId);

    // 9. Build rich mission list for AI prompt (grouped by day)
    const completedMissionsByDay = dailyBreakdown.map(day => {
      const dayEvents = events.filter(e => e.date === day.date);
      return {
        date: day.date,
        missions: dayEvents.map(e => ({
          title: e.missionTitle,
          description: e.missionDescription || null,
          difficulty: e.difficulty,
          isDailyMission: e.isDailyMission,
          skillName: e.skillName || null,
          questTitle: e.questTitle || null,
          xpEarned: e.xpEarned || 0,
        })),
      };
    }).filter(d => d.missions.length > 0);

    // 10. Check for existing snapshot to preserve story / user edits
    let existingUserStory = null;
    let existingAiStory = null;
    let existingAiStoryGeneratedAt = null;
    try {
      const existingSnap = await getDoc(doc(db, 'users', userId, 'weeklySnapshots', weekStart));
      if (existingSnap.exists()) {
        const data = existingSnap.data();
        existingUserStory = data.userEditedStory ?? null;
        existingAiStory = data.aiStory ?? null;
        existingAiStoryGeneratedAt = data.aiStoryGeneratedAt ?? null;
      }
    } catch { /* non-fatal */ }

    // 11. Generate AI story
    let aiStory = (!forceNewStory && existingAiStory) ? existingAiStory : null;
    let aiStoryGeneratedAt = (!forceNewStory && existingAiStory) ? existingAiStoryGeneratedAt : null;

    if (totalMissionsCompleted > 0 && (forceNewStory || !existingAiStory)) {
      try {
        const storyData = {
          displayName: displayName || profile?.displayName || 'You',
          weekStart,
          weekEnd,
          completedMissionsByDay,
          totalMissionsCompleted,
          totalXpEarned,
          levelUps,
          skillLevelUps,
          skillsUsed,
          questsAdvanced,
          dailyBreakdown,
        };
        aiStory = await withTimeout(generateWeeklyStory(storyData), AI_TIMEOUT_MS);
        aiStoryGeneratedAt = new Date().toISOString();
      } catch (err) {
        console.error('Error generating weekly story:', err);
        // Snapshot still saves without story
      }
    }

    // 12. Build and write the snapshot document
    const snapshotData = {
      weekStart,
      weekEnd,
      generatedAt: serverTimestamp(),

      totalMissionsCompleted,
      totalXpEarned,
      totalSpEarned,
      dailyMissionsCompletedCount,
      dailyMissionsTotalCount,

      dailyBreakdown,
      skillsUsed,
      questsAdvanced,
      questsCompleted: [],

      levelUps,
      skillLevelUps,

      levelAtEndOfWeek: profile?.level || 1,
      totalXPAtEndOfWeek: profile?.totalXP || 0,

      aiStoryGenerated: aiStory !== null,
      aiStory,
      aiStoryGeneratedAt,
      userEditedStory: existingUserStory ?? null,
    };

    const snapshotRef = doc(db, 'users', userId, 'weeklySnapshots', weekStart);
    await setDoc(snapshotRef, snapshotData);

    return snapshotData;
  } catch (error) {
    console.error('Error generating weekly snapshot:', error);
    throw error;
  }
};

// ─── Story update ──────────────────────────────────────────────────────────────

/**
 * Saves the user's edited story back to the weekly snapshot.
 */
export const updateWeeklySnapshotStory = async (userId, weekStart, storyText) => {
  try {
    const ref = doc(db, 'users', userId, 'weeklySnapshots', weekStart);
    await updateDoc(ref, {
      userEditedStory: storyText,
      userEditedStoryAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating weekly snapshot story:', error);
    throw error;
  }
};

// ─── AI Story Generation ──────────────────────────────────────────────────────

/**
 * Calls the Anthropic API to generate a weekly chronicle entry.
 * Uses a hero's-journey framing — looks for arc, common threads, and dramatic turns.
 *
 * @param {object} data - Aggregated week data
 * @returns {string} The generated story text
 */
export const generateWeeklyStory = async (data) => {
  try {
    const {
      displayName,
      weekStart,
      weekEnd,
      completedMissionsByDay,
      totalMissionsCompleted,
      totalXpEarned,
      levelUps,
      skillLevelUps,
      skillsUsed,
      questsAdvanced,
      dailyBreakdown,
    } = data;

    // Format the week range for context
    const weekRange = `${dayjs(weekStart).format('MMM D')} – ${dayjs(weekEnd).format('MMM D, YYYY')}`;

    // Build day-by-day mission list
    const dayLines = completedMissionsByDay.map(day => {
      const dayName = dayjs(day.date).format('dddd (MMM D)');
      const missionList = day.missions.map(m => {
        const parts = [
          `  • "${m.title}"`,
          m.description ? ` — ${m.description}` : '',
          ` (${m.difficulty}`,
          m.isDailyMission ? ', daily' : '',
          m.skillName ? `, ${m.skillName}` : '',
          m.questTitle ? `, "${m.questTitle}"` : '',
          ')',
        ];
        return parts.join('');
      });
      return `${dayName}: ${day.missions.length} mission${day.missions.length !== 1 ? 's' : ''}\n${missionList.join('\n')}`;
    });

    // Notable events
    const events = [];
    if (levelUps.length > 0) {
      events.push(`Reached level ${levelUps[levelUps.length - 1].newLevel} during the week.`);
    }
    skillLevelUps.forEach(s => {
      events.push(`${s.skillName} skill reached level ${s.newLevel}.`);
    });

    // Days active
    const daysActive = dailyBreakdown.filter(d => d.missionsCompleted > 0).length;

    // Top skills for the week
    const topSkills = [...skillsUsed]
      .sort((a, b) => b.missionsCompleted - a.missionsCompleted)
      .slice(0, 3)
      .map(s => s.name);

    // Quests with most progress
    const topQuests = [...questsAdvanced]
      .sort((a, b) => b.missionsCompleted - a.missionsCompleted)
      .slice(0, 2)
      .map(q => `"${q.questTitle}" (${q.missionsCompleted} mission${q.missionsCompleted !== 1 ? 's' : ''})`);

    const userPrompt = `
Week of ${weekRange}

Total: ${totalMissionsCompleted} missions completed across ${daysActive} of 7 days, ${totalXpEarned} XP earned

Day-by-day breakdown:
${dayLines.join('\n\n')}
${events.length > 0 ? `\nNotable events:\n${events.map(e => `- ${e}`).join('\n')}` : ''}
${topSkills.length > 0 ? `\nTop skill areas: ${topSkills.join(', ')}` : ''}
${topQuests.length > 0 ? `\nMost active quests: ${topQuests.join(', ')}` : ''}

Write the weekly chronicle entry.`.trim();

    const systemPrompt = `You write the weekly chronicle for a mom whose life is framed as an RPG. Her tasks are "missions," her projects are "quests," her home is her base. You are recording her week — not informing her of what happened, because she was there.

Your job is to find the arc of the week. Look for: recurring patterns across days, a quest that made real progress, a tough patch followed by a recovery, the contrast between a quiet day and a busy one. The week has a shape — find it.

Write in a voice inspired by Terry Pratchett: warm, a little wry, takes mundane things completely seriously, finds the human truth in small moments. Whimsy is welcome. Embellishment is welcome. Drama is welcome — more so than in a daily entry.

Think of this as a hero's journey recap, not a summary. The reader already knows the facts. Give them the story — the meaning, the turning points, what the week cost and what it built.

Rules:
- 5–7 sentences
- Second person ("You...")
- No exclamation points
- Never use the word "adventurer"
- Look for common threads across multiple days, not just a list of each day
- If there was a hard day followed by a strong comeback, that's the story
- Under 200 words`;

    const response = await fetch('/api/anthropic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
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
