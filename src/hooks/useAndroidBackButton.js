// src/hooks/useAndroidBackButton.js

import { useEffect, useRef } from 'react';

/**
 * Intercepts the Android/browser hardware back button on a page so it
 * runs the page's "up" handler instead of popping browser history. Pair
 * with the same function the in-UI back button uses so the two stay in
 * sync — OS back always goes one level up the page graph, not to the
 * last URL the user saw.
 *
 * On mount, pushes a sentinel history entry at the same URL so the back
 * button has something to consume. When back is pressed, onBack() runs
 * instead of letting the browser navigate.
 *
 * Composes with useModalBackButton: a modal's sentinel sits on top of
 * the page sentinel, so an open modal always intercepts back first; the
 * page sentinel only fires when no modal is in the way.
 *
 * Don't call this on root-level pages where the OS default (exit PWA /
 * browser back) is the correct behavior — e.g. HomePage, auth pages.
 *
 * Usage:
 *   const handleBack = () => navigate('/skills');
 *   useAndroidBackButton(handleBack);
 *   <button onClick={handleBack}>...</button>
 */
export function useAndroidBackButton(onBack) {
  const consumedViaBack = useRef(false);
  // Keep onBack in a ref so it's always current without being a dep.
  // Without this, an inline-arrow handler causes the effect to re-run on
  // every parent re-render, producing extra effect cycles at the wrong
  // history position.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  // Deferred history.back() timer. Deferring one macrotask lets React
  // StrictMode's synchronous cleanup→remount cancel it before it fires,
  // so no phantom history entries accumulate.
  const cleanupTimer = useRef(null);

  useEffect(() => {
    if (!onBack) return;

    consumedViaBack.current = false;

    if (cleanupTimer.current !== null) {
      // StrictMode re-run: a deferred sentinel removal is pending. Cancel it
      // and adopt the existing sentinel rather than pushing a second one.
      clearTimeout(cleanupTimer.current);
      cleanupTimer.current = null;
    } else {
      // Fresh mount: push a sentinel at the same URL so the back button
      // has something to consume without navigating away.
      history.pushState({ __pageSentinel: true }, '', location.href);
    }

    const handlePopState = (event) => {
      // A modal sentinel is on top — useModalBackButton handles it.
      if (event.state && event.state.__modalSentinel) {
        return;
      }
      consumedViaBack.current = true;
      onBackRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Only pop the sentinel if the current entry still IS our sentinel
      // (i.e., the unmount wasn't caused by a forward navigation that
      // pushed a new entry on top). Mirrors useModalBackButton's pattern.
      if (!consumedViaBack.current) {
        cleanupTimer.current = setTimeout(() => {
          cleanupTimer.current = null;
          if (history.state?.__pageSentinel) history.back();
        }, 0);
      }
    };
  }, []); // onBack intentionally excluded — kept current via onBackRef
}
