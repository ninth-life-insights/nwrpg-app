// utils/pageNameHelpers.js
// Maps app routes to friendly labels for surfaces that need a human-readable
// page name (e.g. "On Mission Bank" in the feedback modal). Falls back to the
// raw pathname if unmapped, so unrouted/new pages still produce something.

const STATIC_ROUTES = {
  '/': 'Landing',
  '/log-in': 'Log In',
  '/sign-up': 'Sign Up',
  '/terms': 'Terms',
  '/privacy': 'Privacy Policy',
  '/character-creation': 'Character Creation',
  '/home': 'Home',
  '/edit-daily-missions': 'Edit Daily Missions',
  '/daily-review': 'Daily Review',
  '/mission-bank': 'Mission Bank',
  '/routines': 'Routines',
  '/routine-builder': 'Routine Builder',
  '/routine-builder/week-view': 'Routine Builder · Week',
  '/routine-builder/month-view': 'Routine Builder · Month',
  '/deleted-missions': 'Deleted Missions',
  '/base': 'Base',
  '/quest-bank': 'Quest Bank',
  '/deleted-quests': 'Deleted Quests',
  '/skills': 'Skills',
  '/weekly-review': 'Weekly Review',
  '/adventure-log': 'Adventure Log',
  '/achievements': 'Achievements',
  '/settings': 'Settings',
  '/edit-character': 'Edit Character',
};

// Routes with dynamic segments — matched by prefix.
const DYNAMIC_ROUTE_PREFIXES = [
  { prefix: '/room/', label: 'Room' },
  { prefix: '/quests/', label: 'Quest Detail' },
  { prefix: '/skills/', label: 'Skill Detail' },
  { prefix: '/adventure-log/weekly/', label: 'Weekly Log Detail' },
  { prefix: '/adventure-log/', label: 'Daily Log Detail' },
];

export const getPageDisplayName = (pathname) => {
  if (!pathname) return '';
  if (STATIC_ROUTES[pathname]) return STATIC_ROUTES[pathname];
  for (const { prefix, label } of DYNAMIC_ROUTE_PREFIXES) {
    if (pathname.startsWith(prefix)) return label;
  }
  return pathname;
};
