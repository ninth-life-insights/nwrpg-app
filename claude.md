## Working Style

- When you need clarification, ask open-ended questions rather than multiple choice options.
- Before solving a problem, ask follow-up questions or provide debugging code to diagnose the root cause first. Offer multiple theories when relevant.
- If you can't find a file you need, stop and ask for it. Don't assume it doesn't exist or create a new one.
- Do not make extra or unspecified changes when editing existing code. You can make recommendations, but don't implement them without permission.

## About the Project

A mobile PWA to help stay-at-home moms manage tasks, projects, kids, and home life — framed as an RPG adventure. Built with React, React Router, Firebase, and Claude (LLM integration planned).

The developer has a UX design background with some coding experience but is new to React. Prioritize clear explanations alongside code changes.

Currently in personal-use MVP prototype phase, but with eventual plans to publish and monetize. Balance efficiency now with long-term viability.

## Code

- Follow existing file and component structure — don't reorganize without asking.
- Make sure to check for existing helper functions, services, and design patterns before writing something new. Look for opportunities to streamline, generalize components, or increase inter-operability.
- Prefer small, focused changes. Flag anything that might have broader side effects.


## Architecture Quick Reference

- **Routing:** `src/App.jsx` — flat React Router v7; `ProtectedRoutes` / `PublicRoutes` wrappers
- **State:** React Context only (`src/contexts/`). `AuthContext` for user/auth. `NotificationContext` for level-up/skill-up modals. No Redux.
- **Services:** All Firebase ops in `src/services/`. Each service exports standalone async functions that take `userId` as the first arg. Remove `id` field before writing to Firestore; re-attach on reads. Always use Firestore `serverTimestamp()` on writes.
- **CSS:** Each component has a colocated `.css` file. Global design tokens in `src/styles/variables.css`. No CSS-in-JS. Tailwind is installed but not in use.
- **Dates:** Store as `'YYYY-MM-DD'` strings. Use `dayjs` for math. Helpers in `src/utils/dateHelpers.js`.
- **Path aliases:** `@/*` resolves to `src/*` (configured in `jsconfig.json`).

## Existing Utilities — Check Before Writing New Code

**`src/utils/dateHelpers.js`** — `toDateString`, `fromDateString`, `formatForUser`, `formatForUserLong`, `isMissionOverdue`, `isMissionDueToday`, `isMissionDueTomorrow`

**`src/utils/recurrenceHelpers.js`** — `isRecurringMission`, `isEvergreenMission`, `getRecurrenceDisplayText`, `calculateNextDueDate`, `createNextMissionInstance`

**`src/utils/missionHelpers.js`** — `filterMissionsBySkill`, `filterMissionsByDifficulty`, `sortMissionsByDueDate`, `groupMissionsByDueType`, `calculateTotalXPFromMissions`

**`src/utils/themeUtils.js`** — `updateThemeColor(color)` updates the CSS custom property for the user's theme

**`src/components/ui/Badge.jsx`** — Generic badge for difficulty, skill, daily, status, dates. Use before creating any new badge/tag element.

## Firestore Data Model

```
users/{userId}/
  profile/data          — level, XP, streak, character color/class/title
  missions/{id}         — see src/types/Mission.js for full schema
  quests/{id}           — see src/types/Quests.js
  dailyMissions/config  — today's daily mission IDs
  dailyHistory/{date}   — daily mission history per date
  encounters/{id}       — story moments
  dailySnapshots/{date} — daily review summaries
  activityLog/{id}      — event log (completions, encounters)
  rooms/{id}            — home base rooms
```

## Tests

Test files exist in `src/services/tests/`, `src/components/missions/tests/`, `src/pages/tests/`, and `src/types/tests/` — but they are currently deprecated and not maintained. Do not rely on them as a source of truth, and don't write new tests unless explicitly asked.

## Design & UX

- Prioritize usability, clear visual communication, and clear hierarchy.
- This is a mobile-first PWA — design and test with mobile viewports in mind.

## Copy & Tone

- Keep content focused on the mom and her daily life. Add RPG elements for fun, but don't let it obscure the core message and feature mapping onto her day-to-day existence.
- Avoid being too cheesy.