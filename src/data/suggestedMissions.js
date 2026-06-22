// Curated mission templates that surface as suggestions inside multiple
// pickers (room setup, routine builder, etc.). Each template lists the
// surfaces it's relevant to via roomIcons / routineContexts / tags so a
// single catalog feeds every surface.
//
// All fields besides title are optional. When a suggestion is added, the
// caller fills in baseLocation (= the actual roomId) and any other context-
// specific fields before passing to createMission().
//
// Edit freely — this is starter content, not a contract.

import { DIFFICULTY_LEVELS, DUE_TYPES } from '../types/Mission';

const easy = DIFFICULTY_LEVELS.EASY;
const medium = DIFFICULTY_LEVELS.MEDIUM;
const hard = DIFFICULTY_LEVELS.HARD;

// Routine contexts a suggestion can attach to. Used by routine builder
// filtering. Pick the closest match — these are intentionally loose.
export const ROUTINE_CONTEXTS = {
  MORNING: 'morning',
  EVENING: 'evening',
  BEDTIME: 'bedtime',
  WEEKDAY: 'weekday',
  WEEKEND: 'weekend',
};

export const SUGGESTED_MISSIONS = [
  // ── Kitchen ──────────────────────────────────────────────────────────
  { title: 'Load the dishwasher', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-kitchen.png', 'Room-cook.png'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING],
    tags: ['daily-essentials'] },
  { title: 'Unload the dishwasher', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-kitchen.png', 'Room-cook.png'],
    routineContexts: [ROUTINE_CONTEXTS.MORNING],
    tags: ['daily-essentials'] },
  { title: 'Wipe down the counters', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-kitchen.png', 'Room-cook.png'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING],
    tags: ['quick-win'] },
  { title: 'Empty the kitchen trash', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-kitchen.png'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Plan tomorrow\'s meals', difficulty: medium, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-kitchen.png'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Clean out the fridge', difficulty: medium, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-kitchen.png'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Bathroom ─────────────────────────────────────────────────────────
  { title: 'Wipe down the bathroom counters', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-Shower.jpg', 'Room-bath.png'],
    routineContexts: [ROUTINE_CONTEXTS.MORNING] },
  { title: 'Clean the toilet', difficulty: medium, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-toilet.jpg', 'Room-Shower.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },
  { title: 'Restock toilet paper', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-toilet.jpg', 'Room-Shower.jpg'] },
  { title: 'Scrub the shower', difficulty: hard, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-Shower.jpg', 'Room-bath.png'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Bedroom ──────────────────────────────────────────────────────────
  { title: 'Make the bed', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-bed.jpg', 'Room-sleep.png'],
    routineContexts: [ROUTINE_CONTEXTS.MORNING],
    tags: ['daily-essentials'] },
  { title: 'Put laundry away', difficulty: medium, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-bed.jpg', 'Room-sleep.png', 'Room-laundry.png'] },
  { title: 'Change the sheets', difficulty: medium, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-bed.jpg', 'Room-sleep.png'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Living Room / TV ────────────────────────────────────────────────
  { title: 'Tidy the living room', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-couch.jpg', 'Room-TV.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Fluff and rotate cushions', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-couch.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },
  { title: 'Vacuum the rug', difficulty: medium, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-couch.jpg', 'Room-TV.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Dining Room ─────────────────────────────────────────────────────
  { title: 'Wipe the dining table', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-dining.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Set the table', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-dining.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },

  // ── Laundry ─────────────────────────────────────────────────────────
  { title: 'Run a load of laundry', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-laundry.png'] },
  { title: 'Fold the dry laundry', difficulty: medium, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-laundry.png'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Wipe down the washer and dryer', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-laundry.png'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Nursery / Playroom ──────────────────────────────────────────────
  { title: 'Tidy the toys', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-crib.png', 'Room-toys.png'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Sanitize high-touch surfaces', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-crib.png', 'Room-toys.png'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },
  { title: 'Restock diapers and wipes', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-crib.png'] },

  // ── Study / Craft ───────────────────────────────────────────────────
  { title: 'Clear the desk', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-books.png', 'Room-craft.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Sort the mail', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-books.png', 'Room-entry.jpg'] },

  // ── Entryway ────────────────────────────────────────────────────────
  { title: 'Put shoes away', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-entry.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Sweep the entryway', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-entry.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Outdoors / Garage ───────────────────────────────────────────────
  { title: 'Take out the trash', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-garage.png', 'Room-outdoors.png'] },
  { title: 'Water the plants', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-outdoors.png'],
    routineContexts: [ROUTINE_CONTEXTS.MORNING] },
  { title: 'Tidy the garage', difficulty: medium, dueType: DUE_TYPES.EVERGREEN,
    roomIcons: ['Room-garage.png'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Self-care / Personal (room-agnostic; routine surfaces only) ─────
  { title: 'Drink a glass of water', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    routineContexts: [ROUTINE_CONTEXTS.MORNING],
    tags: ['self-care'] },
  { title: 'Take five deep breaths', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    routineContexts: [ROUTINE_CONTEXTS.MORNING, ROUTINE_CONTEXTS.EVENING],
    tags: ['self-care'] },
  { title: 'Stretch for five minutes', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    routineContexts: [ROUTINE_CONTEXTS.MORNING],
    tags: ['self-care'] },
  { title: 'Brush teeth', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    routineContexts: [ROUTINE_CONTEXTS.MORNING, ROUTINE_CONTEXTS.BEDTIME],
    tags: ['self-care'] },
];
