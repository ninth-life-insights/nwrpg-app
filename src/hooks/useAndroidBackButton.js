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
  // Unique ID per sentinel so we can tell "my sentinel" apart from another
  // page's sentinel. Without this, a forward navigation lets the next page's
  // sentinel falsely pass the __pageSentinel check, and a modal closing pops
  // back to our sentinel and looks like a hardware back press.
  const sentinelId = useRef(null);

  useEffect(() => {
    if (!onBack) return;

    consumedViaBack.current = false;

    // Capture the URL we're mounted at. A real hardware-back leaving this page
    // changes the URL before popstate fires, so any popstate that lands us on
    // the *same* URL is intermediate same-route history activity (a router
    // redirect, a tutorial navigate-to-current-route, etc.) and should not
    // trigger our onBack. This is defense-in-depth on top of the sentinel
    // checks — if something else has pushed a non-sentinel entry between our
    // page sentinel and a modal sentinel, the modal's cleanup pop lands here
    // without it, and we'd otherwise mistake it for hardware back.
    const mountedHref = location.href;

    if (cleanupTimer.current !== null) {
      // StrictMode re-run: a deferred sentinel removal is pending. Cancel it
      // and adopt the existing sentinel rather than pushing a second one.
      clearTimeout(cleanupTimer.current);
      cleanupTimer.current = null;
    } else {
      // Fresh mount: push a sentinel at the same URL so the back button
      // has something to consume without navigating away.
      sentinelId.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      history.pushState({ __pageSentinel: true, __sentinelId: sentinelId.current }, '', location.href);
    }

    const handlePopState = (event) => {
      // A modal sentinel is on top — useModalBackButton handles it.
      if (event.state && event.state.__modalSentinel) {
        return;
      }
      // We landed back on our own page sentinel — this means a modal beneath
      // us popped its sentinel during UI close, not a hardware back press.
      // Don't fire onBack.
      if (event.state && event.state.__pageSentinel && event.state.__sentinelId === sentinelId.current) {
        return;
      }
      // URL didn't change — we're still on this page. Some other actor pushed
      // a same-URL history entry that just got popped; this is not hardware
      // back leaving the page.
      if (location.href === mountedHref) {
        return;
      }
      consumedViaBack.current = true;
      onBackRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Only pop the sentinel if the current entry still IS our specific
      // sentinel. A forward navigation may have already pushed the next page's
      // sentinel on top — that one has a different ID, so we leave it alone.
      if (!consumedViaBack.current) {
        const myId = sentinelId.current;
        cleanupTimer.current = setTimeout(() => {
          cleanupTimer.current = null;
          if (history.state?.__pageSentinel && history.state.__sentinelId === myId) {
            history.back();
          }
        }, 0);
      }
    };
  }, []); // onBack intentionally excluded — kept current via onBackRef
}
