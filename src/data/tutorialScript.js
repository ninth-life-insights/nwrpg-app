// Overlay scripts for each tutorial step. Keyed by TUTORIAL_STEPS values
// (the mission.tutorialStep field on tutorial mission docs).
//
// Each step is an ordered list of screens. Each screen has a variant:
//   - 'story':    full-screen explainer with a Continue / Got it CTA
//   - 'spotlight': dimmed background with a target-element cutout
//                  (spotlight implementation lands in a follow-up slice)
//
// Each step also declares `completionTrigger`:
//   - 'auto'   — completion is driven by the Phase 1 watchers (the user does
//                the real action elsewhere; the overlay's last screen just
//                educates and offers a "Back to home" close)
//   - 'manual' — the overlay's last screen completes the tutorial mission
//                directly via TutorialContext.completeCurrentStep()

import { TUTORIAL_STEPS } from './tutorialQuest';

// Step 0 — universal welcome. Prepended to whichever step the user opens
// first. After first view, `tutorialWelcomeSeen: true` is written to the
// user doc so subsequent opens skip it.
export const WELCOME_SCREEN = {
  variant: 'story',
  title: 'Welcome to the Tutorial',
  body: [
    "Your first quest is already waiting. The Training Grounds walks you through each part of the app, one by one. Skip around or play in order.",
    "You can opt out anytime by archiving or deleting the quest.",
  ],
  ctaLabel: 'Begin',
};

export const TUTORIAL_SCRIPT = {
  // ── Day-1 priority slots ──────────────────────────────────────────────

  [TUTORIAL_STEPS.CREATE_FIRST_MISSION]: {
    completionTrigger: 'auto',
    screens: [
      {
        variant: 'story',
        title: 'Missions vs quests.',
        body: [
          'Missions are tasks. Quests are projects — groups of missions toward a bigger goal.',
          'A mission has a name, optional description, difficulty, optional skill tag, and a type (unique, repeating, or evergreen).',
        ],
        ctaLabel: 'Open the Mission Bank',
        navigateTo: '/mission-bank',
      },
      {
        variant: 'spotlight',
        target: 'mission-bank-add-btn',
        title: 'Make your first mission.',
        body: [
          'Tap the + to create one. Try something easy — "drink a glass of water" or "take five deep breaths."',
          'When you check it off, this tutorial mission will complete automatically.',
        ],
        ctaLabel: 'Back to home',
      },
    ],
  },

  [TUTORIAL_STEPS.PLAN_FIRST_DAY]: {
    completionTrigger: 'auto',
    screens: [
      {
        variant: 'story',
        title: 'Your top three.',
        body: [
          'Every day, assign your top three priorities to your daily missions to earn bonus XP upon completion.',
          'On hard days, setting fewer or easier priorities, or changing them partway through the day, gives you the flexibility real life demands.',
        ],
        ctaLabel: 'Plan tomorrow',
      },
      {
        variant: 'story',
        title: "Tomorrow's three.",
        body: [
          "Open daily planning, switch the date to tomorrow, and pick three missions. You can edit them anytime.",
          "When you save tomorrow's plan, this tutorial mission completes.",
        ],
        ctaLabel: 'Back to home',
      },
    ],
  },

  [TUTORIAL_STEPS.FIRST_DAILY_REVIEW]: {
    completionTrigger: 'auto',
    screens: [
      {
        variant: 'story',
        title: 'Looking back.',
        body: [
          "A bit of narrative flair can turn a bad day into an inspiring one, and a good day into a heroic one.",
          "The daily review gives you a place to check in, log what actually got done, and write the day into your story.",
        ],
        ctaLabel: 'Continue',
      },
      {
        variant: 'story',
        title: 'When you are ready.',
        body: [
          "Tap Daily Review on the home page when you want to wrap up your day.",
          "Submitting any review — today, tomorrow, or later — completes this tutorial mission.",
        ],
        ctaLabel: 'Back to home',
      },
    ],
  },

  // ── Quest missions (no auto-fire watchers yet — manual for now) ──────

  [TUTORIAL_STEPS.SETUP_BASE]: {
    completionTrigger: 'auto',
    screens: [
      {
        variant: 'story',
        title: 'Your home is your castle.',
        body: [
          'A base gives you a finer-grained filter for finding and planning missions. Tag a mission to the kitchen and you can see what is piling up there without scanning your whole list.',
          'One-time setup: name your base, add rooms, add some missions.',
        ],
        ctaLabel: 'Continue',
      },
      {
        variant: 'story',
        title: 'A weekly look.',
        body: [
          'Each room tracks cleanliness from 1–5. If you do not update it for two weeks, it shows as "unknown" — a nudge to take a fresh look.',
          'Your weekly review surfaces overdue rooms so you get a birds-eye view of your base once a week.',
        ],
        ctaLabel: 'Got it',
      },
    ],
  },

  [TUTORIAL_STEPS.FIRST_ROUTINE]: {
    completionTrigger: 'manual',
    screens: [
      {
        variant: 'story',
        title: 'The rhythm underneath.',
        body: [
          "A lot of daily life isn't a 'priority' — it's the steady stuff underneath. Routines surface that — the morning, the bedtime, the Saturday reset — without it having to be Important every day.",
          'Routines make your recurring rhythm visible and easy to adjust.',
        ],
        ctaLabel: 'Continue',
      },
      {
        variant: 'story',
        title: 'Where they show up.',
        body: [
          '"Up Next" on home shows the next mission in your routine.',
          'Your full routine for the day is also visible on the routines page — useful when you want context, not just the next thing.',
        ],
        ctaLabel: 'Got it',
      },
    ],
  },

  [TUTORIAL_STEPS.TOUR_QUESTS]: {
    completionTrigger: 'manual',
    screens: [
      {
        variant: 'story',
        title: 'About quests.',
        body: [
          'Quests organize missions into larger projects or goals — a renovation, a habit cluster, a kid\'s project, a season of something.',
          'Group the missions, watch the progress, finish the thing.',
        ],
        ctaLabel: 'Continue',
      },
      {
        variant: 'story',
        title: 'Make your own anytime.',
        body: [
          'Quests live in the Quest Bank. Open a quest to see and reorder its missions, edit its details, or archive when finished.',
          'Hit Create Quest from the bank whenever you are ready to make your own.',
        ],
        ctaLabel: 'Got it',
      },
    ],
  },

  [TUTORIAL_STEPS.TOUR_SKILLS]: {
    completionTrigger: 'manual',
    screens: [
      {
        variant: 'story',
        title: 'About skills.',
        body: [
          'Tag a mission with a skill, complete it, and gain SP for that skill. Level up skills the same way you level your character.',
          'Optional flavor — but a satisfying way to track what you are practicing and who you are becoming.',
        ],
        ctaLabel: 'Continue',
      },
      {
        variant: 'story',
        title: 'A handy filter.',
        body: [
          'Tap into a skill to see the missions tied to it — upcoming and completed.',
          'Filtering your mission bank by skill is a great way to find things, especially for projects like foraging or gardening that span a lot of missions.',
        ],
        ctaLabel: 'Got it',
      },
    ],
  },

  [TUTORIAL_STEPS.TOUR_ACHIEVEMENTS]: {
    completionTrigger: 'manual',
    screens: [
      {
        variant: 'story',
        title: 'About achievements.',
        body: [
          'Recognize your efforts with achievements, including built-in rewards for mission-related milestones.',
          'You can also make your own. Whether you finally potty-trained your toddler or just built a gravity-defying block tower, commemorate the milestones worth remembering.',
        ],
        ctaLabel: 'Continue',
      },
      {
        variant: 'story',
        title: 'Tap + to add one.',
        body: [
          'Built-in achievements are up top. Scroll down to see your custom ones — you start with none, but that is about to change.',
          'No commitment required to look around in the builder.',
        ],
        ctaLabel: 'Got it',
      },
    ],
  },
};

/**
 * Resolve the script for a given tutorial step key.
 * Returns `null` if no script exists for the step.
 */
export const getScriptForStep = (stepKey) => TUTORIAL_SCRIPT[stepKey] ?? null;
