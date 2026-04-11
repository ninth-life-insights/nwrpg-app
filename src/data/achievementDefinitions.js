// Static built-in achievement definitions.
// These are never stored in Firestore — only awarded docs live there.
// Merge with Firestore data at display time via achievementService.getMergedAchievementLibrary().

export const ACHIEVEMENT_CATEGORIES = {
  MISSIONS: 'missions',
  HARD_MISSIONS: 'hard_missions',
  QUESTS: 'quests',
  DAILY: 'daily',
  STREAKS: 'streaks',
  QUIRKY: 'quirky',
};

export const BADGE_COLORS = {
  amber:  { bg: '#fde68a', icon: '#92400e', cardAccent: '#f59e0b' },
  green:  { bg: '#6ee7b7', icon: '#064e3b', cardAccent: '#10b981' },
  blue:   { bg: '#93c5fd', icon: '#1e3a8a', cardAccent: '#3b82f6' },
  purple: { bg: '#c4b5fd', icon: '#4c1d95', cardAccent: '#7c3aed' },
  pink:   { bg: '#f9a8d4', icon: '#831843', cardAccent: '#ec4899' },
  red:    { bg: '#fca5a5', icon: '#7f1d1d', cardAccent: '#ef4444' },
  slate:  { bg: '#cbd5e1', icon: '#1e293b', cardAccent: '#64748b' },
};

export const BADGE_ICONS = [
  'star',
  'military_tech',
  'emoji_events',
  'local_fire_department',
  'bolt',
  'favorite',
  'shield',
  'auto_awesome',
  'home',
  'construction',
  'restaurant',
  'fitness_center',
  'menu_book',
  'group',
  'wb_sunny',
  'nights_stay',
];

// checkType values used by achievementService.checkAndAwardAchievements:
//   total_missions    — count all completed missions in activityLog
//   hard_missions     — count completed missions with difficulty === 'hard'
//   missions_in_day   — count completed missions on a given date
//   all_daily_complete — all isDailyMission entries for a date are present
//   total_quests      — count completed quests
//   streak            — profile.streak >= threshold
//   midnight_missions — count missions completed between midnight and 4am
//   early_missions    — count missions completed before 7am

const ACHIEVEMENTS = [
  // --- Missions Completed ---
  {
    id: 'missions_1',
    name: 'First Step',
    description: 'Complete your very first mission.',
    category: ACHIEVEMENT_CATEGORIES.MISSIONS,
    badgeColor: 'amber',
    badgeIcon: 'star',
    checkType: 'total_missions',
    threshold: 1,
  },
  {
    id: 'missions_10',
    name: 'Gathering Momentum',
    description: 'Complete 10 missions.',
    category: ACHIEVEMENT_CATEGORIES.MISSIONS,
    badgeColor: 'amber',
    badgeIcon: 'bolt',
    checkType: 'total_missions',
    threshold: 10,
  },
  {
    id: 'missions_25',
    name: 'The Long Game',
    description: 'Complete 25 missions.',
    category: ACHIEVEMENT_CATEGORIES.MISSIONS,
    badgeColor: 'amber',
    badgeIcon: 'military_tech',
    checkType: 'total_missions',
    threshold: 25,
  },
  {
    id: 'missions_50',
    name: 'Half a Century',
    description: 'Complete 50 missions.',
    category: ACHIEVEMENT_CATEGORIES.MISSIONS,
    badgeColor: 'green',
    badgeIcon: 'emoji_events',
    checkType: 'total_missions',
    threshold: 50,
  },
  {
    id: 'missions_100',
    name: 'Century Adventurer',
    description: 'Complete 100 missions.',
    category: ACHIEVEMENT_CATEGORIES.MISSIONS,
    badgeColor: 'green',
    badgeIcon: 'emoji_events',
    checkType: 'total_missions',
    threshold: 100,
  },
  {
    id: 'missions_500',
    name: 'Legend',
    description: 'Complete 500 missions. You are the quest.',
    category: ACHIEVEMENT_CATEGORIES.MISSIONS,
    badgeColor: 'purple',
    badgeIcon: 'auto_awesome',
    checkType: 'total_missions',
    threshold: 500,
  },

  // --- Hard Missions ---
  {
    id: 'hard_1',
    name: 'Trial by Fire',
    description: 'Complete your first hard mission.',
    category: ACHIEVEMENT_CATEGORIES.HARD_MISSIONS,
    badgeColor: 'red',
    badgeIcon: 'local_fire_department',
    checkType: 'hard_missions',
    threshold: 1,
  },
  {
    id: 'hard_5',
    name: 'Iron Will',
    description: 'Complete 5 hard missions.',
    category: ACHIEVEMENT_CATEGORIES.HARD_MISSIONS,
    badgeColor: 'red',
    badgeIcon: 'shield',
    checkType: 'hard_missions',
    threshold: 5,
  },
  {
    id: 'hard_10',
    name: 'Hardened',
    description: 'Complete 10 hard missions.',
    category: ACHIEVEMENT_CATEGORIES.HARD_MISSIONS,
    badgeColor: 'red',
    badgeIcon: 'shield',
    checkType: 'hard_missions',
    threshold: 10,
  },
  {
    id: 'hard_25',
    name: 'Unbreakable',
    description: 'Complete 25 hard missions. Nothing phases you.',
    category: ACHIEVEMENT_CATEGORIES.HARD_MISSIONS,
    badgeColor: 'red',
    badgeIcon: 'military_tech',
    checkType: 'hard_missions',
    threshold: 25,
  },

  // --- Quests ---
  {
    id: 'quests_1',
    name: 'Quest Begun',
    description: 'Complete your first quest.',
    category: ACHIEVEMENT_CATEGORIES.QUESTS,
    badgeColor: 'blue',
    badgeIcon: 'menu_book',
    checkType: 'total_quests',
    threshold: 1,
  },
  {
    id: 'quests_5',
    name: 'Quest Veteran',
    description: 'Complete 5 quests.',
    category: ACHIEVEMENT_CATEGORIES.QUESTS,
    badgeColor: 'blue',
    badgeIcon: 'menu_book',
    checkType: 'total_quests',
    threshold: 5,
  },
  {
    id: 'quests_10',
    name: 'Quest Legend',
    description: 'Complete 10 quests.',
    category: ACHIEVEMENT_CATEGORIES.QUESTS,
    badgeColor: 'blue',
    badgeIcon: 'emoji_events',
    checkType: 'total_quests',
    threshold: 10,
  },

  // --- Daily Output ---
  {
    id: 'daily_5_in_day',
    name: "All in a Day's Work",
    description: 'Complete 5 or more missions in a single day.',
    category: ACHIEVEMENT_CATEGORIES.DAILY,
    badgeColor: 'green',
    badgeIcon: 'bolt',
    checkType: 'missions_in_day',
    threshold: 5,
  },
  {
    id: 'daily_10_in_day',
    name: 'Daily Champion',
    description: 'Complete 10 or more missions in a single day.',
    category: ACHIEVEMENT_CATEGORIES.DAILY,
    badgeColor: 'green',
    badgeIcon: 'emoji_events',
    checkType: 'missions_in_day',
    threshold: 10,
  },
  {
    id: 'all_daily_done',
    name: 'Full Sweep',
    description: 'Complete every daily mission on your list in a single day.',
    category: ACHIEVEMENT_CATEGORIES.DAILY,
    badgeColor: 'green',
    badgeIcon: 'auto_awesome',
    checkType: 'all_daily_complete',
    threshold: null,
  },

  // --- Streaks ---
  {
    id: 'streak_3',
    name: 'Streak Starter',
    description: 'Log activity 3 days in a row.',
    category: ACHIEVEMENT_CATEGORIES.STREAKS,
    badgeColor: 'pink',
    badgeIcon: 'local_fire_department',
    checkType: 'streak',
    threshold: 3,
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Log activity 7 days in a row.',
    category: ACHIEVEMENT_CATEGORIES.STREAKS,
    badgeColor: 'pink',
    badgeIcon: 'local_fire_department',
    checkType: 'streak',
    threshold: 7,
  },
  {
    id: 'streak_30',
    name: 'Iron Discipline',
    description: 'Log activity 30 days in a row.',
    category: ACHIEVEMENT_CATEGORIES.STREAKS,
    badgeColor: 'pink',
    badgeIcon: 'military_tech',
    checkType: 'streak',
    threshold: 30,
  },

  // --- Quirky / Fun ---
  {
    id: 'midnight_1',
    name: "Hard Day's Knight",
    description: 'Complete a mission between midnight and 4am. The quest never sleeps.',
    category: ACHIEVEMENT_CATEGORIES.QUIRKY,
    badgeColor: 'slate',
    badgeIcon: 'nights_stay',
    checkType: 'midnight_missions',
    threshold: 1,
  },
  {
    id: 'midnight_5',
    name: 'Night Owl',
    description: 'Complete 5 missions after midnight. Rest is for other adventurers.',
    category: ACHIEVEMENT_CATEGORIES.QUIRKY,
    badgeColor: 'slate',
    badgeIcon: 'nights_stay',
    checkType: 'midnight_missions',
    threshold: 5,
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Complete a mission before 7am.',
    category: ACHIEVEMENT_CATEGORIES.QUIRKY,
    badgeColor: 'amber',
    badgeIcon: 'wb_sunny',
    checkType: 'early_missions',
    threshold: 1,
  },
];

export default ACHIEVEMENTS;

// Map for O(1) lookup by id
export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
