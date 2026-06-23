// Curated mission templates that surface as suggestions inside multiple
// pickers (room setup, routine builder, etc.). Each template lists the
// surfaces it's relevant to via roomIcons / routineContexts / tags so a
// single catalog feeds every surface.
//
// All fields besides title are optional. Each entry declares its natural
// cadence via recurrence + dueType. When added to a routine, callers can
// drop the recurrence (the routine handles cadence). When added to a room
// (RoomPage picker), the recurrence stays so the mission spawns on its
// natural schedule.
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

// Skill names — should match exactly with the strings in src/data/Skills.js.
const SKILLS = {
  CARE: 'Caregiving',
  HEAL: 'Healing Arts',
  CLEAN: 'Cleaning & Organizing',
  CRAFT: 'Crafting (DIY, Repairs, etc.)',
  FORAGE: 'Foraging (Shopping, Deals, etc.)',
  STRAT: 'Strategy & Tactics',
  DIPLO: 'Diplomacy & Negotiation',
  CULINARY: 'Culinary Arts',
  FINANCE: 'Finances',
  FITNESS: 'Fitness',
};

// Shorthand recurrence builders. Used inline for readability.
const daily = () => ({ pattern: 'daily', interval: 1 });
const everyNDays = (n) => ({ pattern: 'daily', interval: n });
const weekly = () => ({ pattern: 'weekly', interval: 1 });
const biweekly = () => ({ pattern: 'weekly', interval: 2 });
const monthly = () => ({ pattern: 'monthly', interval: 1 });

export const SUGGESTED_MISSIONS = [
  // ── Kitchen ──────────────────────────────────────────────────────────
  { title: 'Load the dishwasher', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-kitchen.png', 'Room-cook.png'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING],
    tags: ['daily-essentials'] },
  { title: 'Unload the dishwasher', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-kitchen.png', 'Room-cook.png'],
    routineContexts: [ROUTINE_CONTEXTS.MORNING],
    tags: ['daily-essentials'] },
  { title: 'Wipe down the counters', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-kitchen.png', 'Room-cook.png'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING],
    tags: ['quick-win'] },
  { title: 'Empty the kitchen trash', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: everyNDays(2),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-kitchen.png'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Plan tomorrow\'s meals', difficulty: medium, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.CULINARY,
    roomIcons: ['Room-kitchen.png'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Clean out the fridge', difficulty: medium, dueType: DUE_TYPES.RECURRING, recurrence: monthly(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-kitchen.png'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Bathroom ─────────────────────────────────────────────────────────
  { title: 'Wipe down the bathroom counters', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: everyNDays(2),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-Shower.jpg', 'Room-bath.png'],
    routineContexts: [ROUTINE_CONTEXTS.MORNING] },
  { title: 'Clean the toilet', difficulty: medium, dueType: DUE_TYPES.RECURRING, recurrence: weekly(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-toilet.jpg', 'Room-Shower.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },
  { title: 'Restock toilet paper', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    skill: SKILLS.FORAGE,
    roomIcons: ['Room-toilet.jpg', 'Room-Shower.jpg'] },
  { title: 'Scrub the shower', difficulty: hard, dueType: DUE_TYPES.RECURRING, recurrence: monthly(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-Shower.jpg', 'Room-bath.png'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Bedroom ──────────────────────────────────────────────────────────
  { title: 'Make the bed', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-bed.jpg', 'Room-sleep.png'],
    routineContexts: [ROUTINE_CONTEXTS.MORNING],
    tags: ['daily-essentials'] },
  { title: 'Put laundry away', difficulty: medium, dueType: DUE_TYPES.EVERGREEN,
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-bed.jpg', 'Room-sleep.png', 'Room-laundry.png'] },
  { title: 'Change the sheets', difficulty: medium, dueType: DUE_TYPES.RECURRING, recurrence: weekly(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-bed.jpg', 'Room-sleep.png'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Living Room / TV ────────────────────────────────────────────────
  { title: 'Tidy the living room', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-couch.jpg', 'Room-TV.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Fluff and rotate cushions', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: weekly(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-couch.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },
  { title: 'Vacuum the rug', difficulty: medium, dueType: DUE_TYPES.RECURRING, recurrence: weekly(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-couch.jpg', 'Room-TV.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Dining Room ─────────────────────────────────────────────────────
  { title: 'Wipe the dining table', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-dining.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Set the table', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.CARE,
    roomIcons: ['Room-dining.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },

  // ── Laundry ─────────────────────────────────────────────────────────
  { title: 'Run a load of laundry', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-laundry.png'] },
  { title: 'Fold the dry laundry', difficulty: medium, dueType: DUE_TYPES.EVERGREEN,
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-laundry.png'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Wipe down the washer and dryer', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: monthly(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-laundry.png'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Nursery / Playroom ──────────────────────────────────────────────
  { title: 'Tidy the toys', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.CARE,
    roomIcons: ['Room-crib.png', 'Room-toys.png'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Sanitize high-touch surfaces', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: weekly(),
    skill: SKILLS.CARE,
    roomIcons: ['Room-crib.png', 'Room-toys.png'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },
  { title: 'Restock diapers and wipes', difficulty: easy, dueType: DUE_TYPES.EVERGREEN,
    skill: SKILLS.FORAGE,
    roomIcons: ['Room-crib.png'] },

  // ── Study / Craft ───────────────────────────────────────────────────
  { title: 'Clear the desk', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-books.png', 'Room-craft.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Sort the mail', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: everyNDays(2),
    skill: SKILLS.STRAT,
    roomIcons: ['Room-books.png', 'Room-entry.jpg'] },

  // ── Entryway ────────────────────────────────────────────────────────
  { title: 'Put shoes away', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-entry.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.EVENING] },
  { title: 'Sweep the entryway', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: weekly(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-entry.jpg'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Outdoors / Garage ───────────────────────────────────────────────
  { title: 'Take out the trash', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: weekly(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-garage.png', 'Room-outdoors.png'] },
  { title: 'Water the plants', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: everyNDays(3),
    skill: SKILLS.CARE,
    roomIcons: ['Room-outdoors.png'],
    routineContexts: [ROUTINE_CONTEXTS.MORNING] },
  { title: 'Tidy the garage', difficulty: medium, dueType: DUE_TYPES.RECURRING, recurrence: monthly(),
    skill: SKILLS.CLEAN,
    roomIcons: ['Room-garage.png'],
    routineContexts: [ROUTINE_CONTEXTS.WEEKEND] },

  // ── Self-care / Personal (room-agnostic; routine surfaces only) ─────
  { title: 'Drink a glass of water', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.HEAL,
    routineContexts: [ROUTINE_CONTEXTS.MORNING],
    tags: ['self-care'] },
  { title: 'Take five deep breaths', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.HEAL,
    routineContexts: [ROUTINE_CONTEXTS.MORNING, ROUTINE_CONTEXTS.EVENING],
    tags: ['self-care'] },
  { title: 'Stretch for five minutes', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.FITNESS,
    routineContexts: [ROUTINE_CONTEXTS.MORNING],
    tags: ['self-care'] },
  { title: 'Brush teeth', difficulty: easy, dueType: DUE_TYPES.RECURRING, recurrence: daily(),
    skill: SKILLS.HEAL,
    routineContexts: [ROUTINE_CONTEXTS.MORNING, ROUTINE_CONTEXTS.BEDTIME],
    tags: ['self-care'] },
];
