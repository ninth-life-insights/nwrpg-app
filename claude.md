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
- **Soft Delete:** Nothing is permanently removed from Firestore. Set `status: 'deleted'` + `deletedAt: serverTimestamp()` on the doc. Reference: `deleteMission()` in `src/services/missionService.js`. All list queries must exclude `status === 'deleted'` docs.
- **Path aliases:** `@/*` resolves to `src/*` (configured in `jsconfig.json`).

## Existing Utilities — Check Before Writing New Code

**`src/utils/dateHelpers.js`** — `toDateString`, `fromDateString`, `formatForUser`, `formatForUserLong`, `isMissionOverdue`, `isMissionDueToday`, `isMissionDueTomorrow`

**`src/utils/recurrenceHelpers.js`** — `isRecurringMission`, `isEvergreenMission`, `getRecurrenceDisplayText`, `calculateNextDueDate`, `createNextMissionInstance`

**`src/utils/missionHelpers.js`** — `filterMissionsBySkill`, `filterMissionsByDifficulty`, `sortMissionsByDueDate`, `groupMissionsByDueType`, `calculateTotalXPFromMissions`

**`src/utils/themeUtils.js`** — `updateThemeColor(color)` updates the CSS custom property for the user's theme

**`src/components/ui/Badge.jsx`** — Generic badge for difficulty, skill, daily, status, dates. Use before creating any new badge/tag element.

**`src/components/ui/ErrorMessage.jsx`** — Inline persistent error display. Props: `message` (string, required), `onRetry` (function, optional — renders "Try again" button), `className` (string, optional). Import and use this before writing any custom error div.

**`src/components/ui/StickyFooter.jsx`** — Fixed bottom action area for pages with a primary save/submit/confirm CTA. Props: `children`, `bgColor` (optional — CSS color/var for the gradient, defaults to `var(--color-bg-main)`; pass `"var(--color-bg-white)"` for white-background pages), `className` (optional). The parent scroll container must add `padding-bottom: 120px`.

**`src/utils/authErrors.js`** — `getAuthErrorMessage(error, mode)` maps Firebase auth error codes to user-facing strings. `mode` is `'login'` or `'signup'`. Use in any auth flow instead of hardcoding error text.

## Sticky Footer Patterns

Use a sticky bottom action area whenever the primary CTA (save, submit, confirm) lives at the end of potentially-scrollable content. There are two patterns in the app — pick the right one for the context.

### Pattern 1 — Sticky Form Footer (`StickyFooter` component)

For **pages** with a single primary action (save, submit, confirm, set). Renders a gradient-faded fixed panel centered at the bottom, max-width `--max-width-card`.

```jsx
import StickyFooter from '../components/ui/StickyFooter';

// Default (cream/--color-bg-main background pages):
<StickyFooter>
  <button className="save-btn">Save</button>
</StickyFooter>

// White-background pages:
<StickyFooter bgColor="var(--color-bg-white)">
  <button className="save-btn">Save</button>
</StickyFooter>
```

**Required:** Add `padding-bottom: 120px` to the page's scroll container so content isn't hidden behind the footer.

Error messages that relate to the CTA (e.g. `saveError`) should be placed as children inside `<StickyFooter>` above the button.

Used in: `EditDailyMissionsPage`, `SettingsPage`, `CharacterCreationPage`, `DailyReviewPage` step components.

---

### Pattern 2 — Floating FAB

For **pages** where the primary action is "add" or "create" and should float above content rather than anchor to the edge. Use a centered pill button with `position: fixed; bottom: 24px`.

Reference implementation: `AchievementsPage` (`.achievements-fab` in `AchievementsPage.css`).

The parent page needs `padding-bottom: 100px` to prevent content from scrolling under the button.

---

### What NOT to use

`QuestDetailView`'s `.quest-actions` bar is **not a standard pattern** — it predates the three-dot menu and will be reworked as part of the quest UI overhaul. Do not replicate it.

Modal footers (e.g. `CreateQuestModal`) are a separate concern — they use `position: sticky` within the modal's scroll container, not `position: fixed`.

## Error Handling Patterns

### Principle
Errors are **inline and persistent** — they appear near their source and stay until the user retries or navigates away. No toasts, no global error context. Each component owns its error state.

### State variables by error type

| State var | Purpose | Example |
|---|---|---|
| `loadError` | Data failed to fetch on mount | Page can't load its content |
| `actionError` | A user-triggered mutation failed | Complete/delete/reorder failed |
| `saveError` / `submitError` | A form save or multi-step flow submission failed | Settings save, review submit |

### Retry patterns

**When fetch lives inside `useCallback`** (can be passed as `onRetry` directly):
```jsx
const fetchData = useCallback(async () => {
  setLoadError(null);
  try { ... } catch { setLoadError('...') }
}, [deps]);
// In JSX:
<ErrorMessage message={loadError} onRetry={fetchData} />
```

**When fetch lives inside `useEffect`** (use a `reloadTrigger` counter):
```jsx
const [reloadTrigger, setReloadTrigger] = useState(0);
useEffect(() => { fetchData(); }, [currentUser, reloadTrigger]);
// Retry:
<ErrorMessage message={loadError} onRetry={() => { setLoadError(null); setReloadTrigger(t => t + 1); }} />
```

### Placement
- **Load errors**: render after the page `<header>`, before the content it replaces (or alongside it with a Retry)
- **Action errors**: render inline above the list or section where the action originates; clear on the next action attempt
- **Save/submit errors**: render immediately above or below the submit button

### Microcopy guidelines

Use natural, non-blaming language. Avoid passive "couldn't" constructions.

**Load / save failures** — subject is the thing that failed:
> "Your [noun] didn't [verb]." + Retry button
> Examples: "Your missions didn't load." · "Your settings didn't save." · "Your quest wasn't saved."

**Action failures** — subject is the specific item acted on:
> "That [noun] didn't [verb]."
> Examples: "That mission didn't complete." · "That undo didn't go through." · "That quest didn't delete."

**Critical / data-loss risk** — be explicit about what to do:
> "Your review wasn't saved. Stay on this page and retry."

**Auth errors** — handled by `getAuthErrorMessage()`. Firebase v12 cannot distinguish wrong password from unknown email (intentional security behavior) — use the consolidated message "Incorrect email or password. Try again."

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