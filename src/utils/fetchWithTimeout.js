// src/utils/fetchWithTimeout.js

export const FIREBASE_TIMEOUT_MS = 8000;
export const AI_TIMEOUT_MS = 25000;

export class LoadTimeoutError extends Error {
  constructor() {
    super('Request timed out');
    this.name = 'LoadTimeoutError';
  }
}

/**
 * Wraps a promise with a timeout. Throws LoadTimeoutError if the promise
 * does not settle within ms milliseconds.
 */
export function withTimeout(promise, ms = FIREBASE_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new LoadTimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Returns true only when the browser explicitly reports offline.
 * Advisory — does not gate requests (stale flag possible on poor connections).
 */
export function isDefinitelyOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Returns contextual user-facing error copy based on error type.
 * Follows the app convention: "Your [subject] didn't load."
 *
 * @param {Error} error
 * @param {string} subject - e.g. 'missions', 'achievements', 'skills'
 * @returns {string}
 */
export function getLoadErrorMessage(error, subject) {
  if (error instanceof LoadTimeoutError) {
    return `Your ${subject} didn't load. The connection is taking too long.`;
  }
  return `Your ${subject} didn't load.`;
}
