// Overlay scripts for each tutorial step. Keyed by TUTORIAL_STEPS values
// (the mission.tutorialStep field on tutorial mission docs).
//
// Each step is an ordered list of screens. Each screen has a variant:
//   - 'story':     full-screen explainer with a Continue / Got it CTA
//   - 'spotlight': dimmed background with a target-element cutout
//   - 'wait':      invisible — pauses the tutorial until a watched event
//                  fires (e.g. mission-created). Auto-advances on event.
//
// Spotlight `target` can be:
//   - a string:    a single data-tutorial-target value
//   - an array:    multiple data-tutorial-target values, unioned into one
//                  bounding rect (use for adjacent UI groups)
//   - a function:  receives the activeStep and returns a string or array.
//                  Use when the target depends on runtime data (e.g. the
//                  id of a just-created mission captured by a wait screen).
//
// Optional spotlight fields:
//   - revertOnTargetLoss: number of screens to step back if the target
//                         element disappears mid-spotlight (e.g. the user
//                         dismisses the modal it was pointing at).
//   - waitForCompletion:  true → spotlight stays put until an external
//                         watcher clears activeStep (e.g. the Phase 1
//                         mission-completion watcher finishes the tutorial
//                         mission). Off-clicks and target clicks pass
//                         through; only the X button can dismiss.
//   - expectsRouteChangeOnAdvance: true → the target click is expected to
//                         navigate the app (e.g. a card click that opens a
//                         detail page). Arms the route-change watcher to
//                         skip its dismiss-on-route-change behavior for the
//                         next transition, so the next screen can render on
//                         the new route.
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
    "The first three steps are on your home page as today's daily missions."
  ],
  ctaLabel: 'Begin',
};

// Standalone intro flow shown on first arrival at /home after character
// creation. Welcome story + a quick spotlight pointing at the Quests button
// so the user knows where to find the Training Grounds quest later.
// Auto-fire path: TutorialContext watches pathname === '/home' and opens
// this when `welcomeSeen === false`. Sharing the welcome screen reference
// means advancing off screen 0 still trips markWelcomeSeen() in the
// overlay's advance handler.
export const INTRO_SCREENS = [
  WELCOME_SCREEN,
  {
    variant: 'spotlight',
    target: 'home-quests-button',
    title: 'Find the tutorial later',
    body: [
      'Your Training Grounds quest lives in the Quest Bank. Head there anytime to pick it back up.',
      "You can opt out anytime by archiving or deleting the quest.",
    ],
    ctaLabel: 'Got it',
  },
];

export const TUTORIAL_SCRIPT = {
  // ── Day-1 priority slots ──────────────────────────────────────────────

  [TUTORIAL_STEPS.CREATE_FIRST_MISSION]: {
    completionTrigger: 'auto',
    screens: [
      {
        variant: 'story',
        title: 'Missions',
        body: [
          'Missions represent tasks or to-do items. Check them off to earn XP and level up: 5 XP for easy, 10 XP for medium, and 20 XP for hard.',
          'All your missions can be found in the Mission Bank, even if they were created elsewhere.',
        ],
        ctaLabel: 'Open the Mission Bank',
        navigateTo: '/mission-bank',
      },
      {
        variant: 'spotlight',
        target: 'mission-bank-add-btn',
        title: 'Make your first mission',
        body: [
          "Try adding your first mission. Let's keep it basic to start, something like 'drink a glass of water.'",
        ],
      },
      // Multi-target spotlight covering the difficulty selector and the
      // mission-type radios. Explicit CTA so radio clicks don't advance.
      {
        variant: 'spotlight',
        target: ['add-mission-difficulty', 'add-mission-due-type'],
        title: 'Mission types',
        body: [
          'Edit difficulty here. Then, select recurring for missions that repeat, or evergreen for missions you want to keep doing indefinitely without the pressure of a due date.',
        ],
        ctaLabel: 'Show me more',
        revertOnTargetLoss: 1,
      },
      {
        variant: 'spotlight',
        target: 'add-mission-ghost-badges',
        title: 'Spice it up',
        body: [
          "Add a skill to earn SP (Skill Points) and level up your skills. Once you've set up your base or added quests, missions can be assigned to either.",
        ],
        ctaLabel: 'Fill out the details',
        revertOnTargetLoss: 2,
      },
      // Invisible wait state — hides the overlay while the user fills in
      // and saves their first mission. Auto-advances when missions count
      // grows; captures the new mission id into activeStep.waitResult so
      // the next screen can spotlight it.
      {
        variant: 'wait',
        waitFor: 'mission-created',
      },
      {
        variant: 'spotlight',
        target: (step) => step?.waitResult?.newMissionId
          ? `mission-card:${step.waitResult.newMissionId}`
          : null,
        title: 'Check it off',
        body: [
          'Your first mission is now in the Mission Bank. Tap the card to see more details, edit, archive, or delete.',
          'Check it off to earn some XP and finish this tutorial step.',
        ],
        // No CTA: the Phase 1 watcher completes the tutorial mission when the
        // user checks off their custom mission, and the activeStep auto-
        // clears. waitForCompletion stops the spotlight from advancing on
        // body taps (which open the detail view) or dismissing on off-clicks.
        waitForCompletion: true,
      },
    ],
  },

  [TUTORIAL_STEPS.PLAN_FIRST_DAY]: {
    completionTrigger: 'auto',
    screens: [
      {
        variant: 'story',
        title: 'Daily missions',
        body: [
          'Every day, assign your top three priorities to your daily missions to earn bonus XP upon completion.',
          'On hard days, setting fewer or easier priorities, or changing them partway through the day, gives you the flexibility real life demands.',
        ],
        ctaLabel: 'Plan tomorrow',
        navigateTo: '/edit-daily-missions',
      },
      {
        variant: 'spotlight',
        target: 'daily-plan-date-pill',
        title: 'Look ahead',
        body: [
          'Draft future priorities from the dropdown here. Try selecting tomorrow to plan it in advance.',
        ],
      },
      // Last screen of an auto-trigger step. Target click dismisses the
      // spotlight via the default advance path; the daily-plan save watcher
      // (triggerTutorialPlanWatcher in dailyMissionService) completes the
      // tutorial mission whenever the user saves their plan.
      {
        variant: 'spotlight',
        target: 'daily-plan-actions',
        title: 'Add your missions',
        body: [
          'You can create new missions or select from the Mission Bank.',
          'Add at least one priority, then hit save, to finish this tutorial step.',
        ],
      },
    ],
  },

  [TUTORIAL_STEPS.FIRST_DAILY_REVIEW]: {
    completionTrigger: 'auto',
    screens: [
      {
        variant: 'story',
        title: 'Daily reviews',
        body: [
          "A bit of narrative flair can turn a bad day into an inspiring one, and a good day into a heroic one.",
          "The daily review gives you a place to check in, log what actually got done, and write the day into your story.",
        ],
        ctaLabel: 'Continue',
        navigateTo: '/daily-review',
      },
      {
        variant: 'story',
        title: 'Walk through your day',
        body: [
          '1. Priorities: Check off the daily missions you got done, or edit them if your goals changed partway through.',
          "2. Other missions: Log anything else you completed that wasn't on your list. Missions added here are automatically marked complete.",
          '3. Encounters: These notes on events or challenges from the day help flavor your daily story.',
        ],
        ctaLabel: 'Try it out',
      },
      // Wait until the user reaches the review summary step. DailyReviewPage
      // calls notifyReviewSummaryReached() when its internal step becomes 4
      // (ReviewSummary mounts). Tutorial sits invisible while the user does
      // the first three review steps, then pops Screen 3 over the summary.
      {
        variant: 'wait',
        waitFor: 'review-summary',
      },
      {
        variant: 'story',
        title: 'Your daily story',
        body: [
          'The heart of your review is the story, which you can edit or regenerate as needed. (Change the narrative tone in settings.) The daily summary also shows stats, from XP earned and missions completed to level ups, Skill Points, quest progress, and achievements.',
          'Save your daily summary to finish this tutorial step.',
        ],
        ctaLabel: 'Got it',
      },
    ],
  },

  // ── Quest missions (no auto-fire watchers yet — manual for now) ──────

  [TUTORIAL_STEPS.SETUP_BASE]: {
    completionTrigger: 'auto',
    screens: [
      {
        variant: 'story',
        title: 'Your home is your castle',
        body: [
          "Your base is where you can find and plan missions for each room of your home and keep track of what needs attention. Let's customize yours now.",
        ],
        ctaLabel: 'Continue',
        navigateTo: '/base',
      },
      {
        variant: 'spotlight',
        target: 'base-look-btn',
        title: 'A little flair',
        body: [
          "Start by customizing your base's look with a nickname and icon. Tasks can be assigned to the entire base, which also shows a summary of everything across all rooms.",
        ],
        // Opens the base-look modal on top of the page; spotlight cutout
        // remains underneath. Default advance on target click → next screen
        // is the invisible wait, so the room-template spotlight doesn't fire
        // behind the modal while the user is still customizing.
      },
      // Invisible wait — pauses the tutorial while the base-look modal is
      // open. BasePage calls notifyBaseLookSet() when the user saves the
      // base icon/nickname; the wait then advances to the room spotlight.
      {
        variant: 'wait',
        waitFor: 'base-look-set',
      },
      {
        variant: 'spotlight',
        target: [
          'base-page-template-btn',
          'base-page-add-room-btn',
          'add-room-card-template',
        ],
        title: 'Add some rooms',
        body: [
          'Start off with a base template to add a batch of standard rooms, like a 2-bed 1-bath apartment or a 3-bed 2-bath home. Then add or edit rooms one by one to make it yours.',
        ],
      },
      // Wait until at least one custom room is added. Pickers/modals can
      // resolve asynchronously, and createRoomsBatch may add several at
      // once — this just gates on the rooms count growing.
      {
        variant: 'wait',
        waitFor: 'room-created',
      },
      {
        variant: 'spotlight',
        target: 'rooms-grid',
        title: 'Room cleanliness',
        body: [
          "You can track the cleanliness of each room on a scale from 1 to 5. Your weekly review is a great time to check in on where you've been making progress and what needs attention.",
          'Tap on the room card now to see more details.',
        ],
        // User taps a room card → RoomPage opens. Without this flag, the
        // route-change watcher in TutorialContext would dismiss the
        // overlay before Screen 5 renders.
        expectsRouteChangeOnAdvance: true,
      },
      {
        variant: 'story',
        title: 'Manage missions',
        body: [
          "In each room, you can update cleanliness ratings; add, edit, or complete missions; and view your room's cleaning routine. Try adding a task to any room to finish this tutorial step.",
        ],
        ctaLabel: "Let's get cleaning",
      },
    ],
  },

  [TUTORIAL_STEPS.FIRST_ROUTINE]: {
    completionTrigger: 'auto',
    screens: [
      {
        variant: 'story',
        title: 'Routines',
        body: [
          'Your routine includes the missions you do on repeat, surfacing them as needed instead of getting lost in the shuffle.',
          'Routines can include recurring or evergreen missions, but you choose which missions are part of the routine.',
        ],
        ctaLabel: 'Get started',
        navigateTo: '/routine-builder',
      },
      {
        variant: 'spotlight',
        target: 'routine-builder-buckets',
        title: 'Customize your routine',
        body: [
          'Tap Add on any bucket to quick-add missions in bulk, then customize them further afterward. Missions can be dragged between buckets to change their frequency (including evergreen missions).',
          'Tap on Week View or Month View to see where missions cluster and move them around to spread things out.',
        ],
        ctaLabel: 'Got it',
      },
      {
        variant: 'spotlight',
        target: [
          'routine-builder-suggestions-btn',
          'routine-builder-filters',
          'routine-builder-add-existing-btn',
        ],
        title: 'Getting specific',
        body: [
          'Browse suggested missions if you need ideas. Filter to see routines for specific skills or parts of the house. Existing missions can be added to the routine as long as they are recurring or evergreen.',
        ],
        ctaLabel: 'Got it',
      },
      {
        variant: 'story',
        title: 'Set yours up',
        body: [
          'The home page always shows the next mission in your routine. View your full routine to see everything for the current day, or access the routine builder.',
          'Try adding your first routine mission to finish this tutorial step.',
        ],
        ctaLabel: 'Try it out',
      },
    ],
  },

  [TUTORIAL_STEPS.TOUR_QUESTS]: {
    completionTrigger: 'manual',
    screens: [
      {
        variant: 'story',
        title: 'Group your missions',
        body: [
          'Quests let you organize missions into larger projects or goals, helping you stay organized and track progress.',
          'Review quest progress during weekly reviews to stay on top of longer-term efforts.',
        ],
        ctaLabel: 'Continue',
        navigateTo: '/quest-bank',
      },
      {
        variant: 'spotlight',
        target: 'tutorial-quest-card',
        title: 'Quest cards',
        body: [
          'This tutorial is an example of a (special) quest. In the Quest Bank, see progress at a glance and check which mission is up next.',
          'Tap the card to see more details.',
        ],
        // No CTA: tapping the card itself is the way forward — it navigates
        // to the quest detail view, and the underlying click handler does
        // the routing. expectsRouteChangeOnAdvance arms the route watcher
        // so Screen 3 can render on the detail page without getting
        // dismissed.
        expectsRouteChangeOnAdvance: true,
      },
      {
        variant: 'story',
        title: 'Quest details',
        body: [
          "Each quest contains a list of associated missions, as well as details like difficulty and description. Add a custom achievement to celebrate when you're done.",
          'Quests can be marked complete at any time, even if some missions are left undone.',
        ],
        ctaLabel: 'Done learning',
      },
    ],
  },

};

/**
 * Resolve the script for a given tutorial step key.
 * Returns `null` if no script exists for the step.
 */
export const getScriptForStep = (stepKey) => TUTORIAL_SCRIPT[stepKey] ?? null;
