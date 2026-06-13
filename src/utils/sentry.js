import * as Sentry from '@sentry/react';

// Set VITE_SENTRY_DSN in .env.local (for dev) and Vercel env vars (for prod)
// to enable reporting. Leave unset to disable Sentry entirely — useful for
// local dev where you don't want to flood the dashboard.
const DSN = import.meta.env.VITE_SENTRY_DSN;
const enabled = !!DSN;

export function initSentry() {
  if (!enabled) return;
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1, // 10% performance sampling — adjust if quota tight
  });
}

// We tag UID only (not email) to keep PII at the error processor minimal.
// If you need the user's email while debugging, look up the UID in Firebase
// Auth.
export function setSentryUser(user) {
  if (!enabled) return;
  Sentry.setUser(user ? { id: user.uid } : null);
}

export function captureError(error, context) {
  if (!enabled) return;
  Sentry.captureException(error, context ? { contexts: { extra: context } } : undefined);
}
