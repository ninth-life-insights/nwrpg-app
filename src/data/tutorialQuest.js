// Static template for the auto-seeded onboarding quest.
// Read by tutorialService.initializeTutorialQuest at signup time.
//
// Mission order in TUTORIAL_MISSIONS is the order they appear in the quest
// (drives getNextMission's "Next up" preview). The first 3 are auto-seeded
// as today's daily priorities at signup.

import { QUEST_DIFFICULTY, QUEST_TYPE } from '../types/Quests';
import { DIFFICULTY_LEVELS, DUE_TYPES } from '../types/Mission';

// Canonical tutorial step keys. Used by:
//   - tutorial mission docs (mission.tutorialStep)
//   - tutorialScript.js to look up overlay content per step (Phase 2)
//   - Phase 1 watchers in service code to match user actions to steps
export const TUTORIAL_STEPS = {
  CREATE_FIRST_MISSION: 'create_first_mission',
  PLAN_FIRST_DAY: 'plan_first_day',
  FIRST_DAILY_REVIEW: 'first_daily_review',
  SETUP_BASE: 'setup_base',
  FIRST_ROUTINE: 'first_routine',
  TOUR_QUESTS: 'tour_quests',
  TOUR_SKILLS: 'tour_skills',
  TOUR_ACHIEVEMENTS: 'tour_achievements',
};

// Tutorial quest metadata. Difficulty=easy → 10 XP bonus on completion
// (QUEST_XP_REWARDS[easy]). Priority=high so it sorts above user-created
// quests in any priority-aware list view.
export const TUTORIAL_QUEST = {
  title: 'The Training Grounds',
  description: 'Your guided tour through the basics. Each mission walks you through one part of the app.',
  difficulty: QUEST_DIFFICULTY.EASY,
  type: QUEST_TYPE.TUTORIAL,
  priority: 'high',
};

// Tutorial missions in display order. All easy (5 XP each), all unique
// (one-shot walkthroughs), no skill tag (keeps the tutorial skill-agnostic).
// The first 3 become today's daily priorities via setDailyMissions at seed time.
export const TUTORIAL_MISSIONS = [
  {
    title: 'Mission Possible',
    description: 'Make and complete your first mission.',
    tutorialStep: TUTORIAL_STEPS.CREATE_FIRST_MISSION,
    difficulty: DIFFICULTY_LEVELS.EASY,
    dueType: DUE_TYPES.UNIQUE,
  },
  {
    title: 'Get Your Priorities Straight',
    description: "Plan tomorrow's three daily missions.",
    tutorialStep: TUTORIAL_STEPS.PLAN_FIRST_DAY,
    difficulty: DIFFICULTY_LEVELS.EASY,
    dueType: DUE_TYPES.UNIQUE,
  },
  {
    title: 'Hindsight is 20/20',
    description: 'Try the daily review to reflect on how your day went.',
    tutorialStep: TUTORIAL_STEPS.FIRST_DAILY_REVIEW,
    difficulty: DIFFICULTY_LEVELS.EASY,
    dueType: DUE_TYPES.UNIQUE,
  },
  {
    title: 'Home Sweet Home',
    description: 'Set up your base.',
    tutorialStep: TUTORIAL_STEPS.SETUP_BASE,
    difficulty: DIFFICULTY_LEVELS.EASY,
    dueType: DUE_TYPES.UNIQUE,
  },
  {
    title: 'Rinse and Repeat',
    description: 'Start setting up your routine.',
    tutorialStep: TUTORIAL_STEPS.FIRST_ROUTINE,
    difficulty: DIFFICULTY_LEVELS.EASY,
    dueType: DUE_TYPES.UNIQUE,
  },
  {
    title: 'The Plot Thickens',
    description: 'See how quests organize missions toward bigger goals.',
    tutorialStep: TUTORIAL_STEPS.TOUR_QUESTS,
    difficulty: DIFFICULTY_LEVELS.EASY,
    dueType: DUE_TYPES.UNIQUE,
  },
  {
    title: 'Sharpening the Blade',
    description: 'Take a look at skills.',
    tutorialStep: TUTORIAL_STEPS.TOUR_SKILLS,
    difficulty: DIFFICULTY_LEVELS.EASY,
    dueType: DUE_TYPES.UNIQUE,
  },
  {
    title: 'Take a Bow',
    description: 'Take a look at achievements.',
    tutorialStep: TUTORIAL_STEPS.TOUR_ACHIEVEMENTS,
    difficulty: DIFFICULTY_LEVELS.EASY,
    dueType: DUE_TYPES.UNIQUE,
  },
];

// How many of the first tutorial missions are seeded as today's daily priorities.
export const TUTORIAL_DAILY_PRIORITY_COUNT = 3;
