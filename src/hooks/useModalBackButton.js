// src/hooks/useModalBackButton.js

import { useEffect, useRef } from 'react';

/**
 * Intercepts the Android/browser hardware back button to close a modal
 * instead of navigating to the previous page.
 *
 * When isOpen becomes true, pushes a sentinel history entry at the same URL
 * so the back button has something to consume. When back is pressed,
 * onClose() is called instead of navigating away.
 *
 * When the modal is closed via UI (X button, backdrop click, etc.),
 * the sentinel entry is cleaned up from history automatically.
 *
 * For always-mounted modals (conditionally rendered by parent, no isOpen prop),
 * pass true as isOpen.
 *
 * Usage:
 *   useModalBackButton(isOpen, onClose);
 *   useModalBackButton(true, onClose); // always-mounted modal
 */
export function useModalBackButton(isOpen, onClose) {
  const closedViaBack = useRef(false);
  // Keep onClose in a ref so it's always current without being a dep.
  // Without this, an inline-arrow onClose prop causes the effect to re-run on
  // every parent re-render, producing extra effect cycles at the wrong history position.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Deferred history.back() timer. Deferring one macrotask lets React StrictMode's
  // synchronous cleanup→remount cancel it before it fires, so no phantom history
  // entries accumulate and hardware back always closes the modal cleanly.
  const cleanupTimer = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    closedViaBack.current = false;

    if (cleanupTimer.current !== null) {
      // StrictMode re-run: a deferred sentinel removal is pending. Cancel it
      // and adopt the existing sentinel rather than pushing a second one.
      clearTimeout(cleanupTimer.current);
      cleanupTimer.current = null;
    } else {
      // Fresh open: push a sentinel at the same URL so the back button has
      // something to consume without navigating away.
      history.pushState({ __modalSentinel: true }, '', location.href);
    }

    const handlePopState = (event) => {
      // A nested modal's deferred back() landed us on another sentinel — ignore.
      if (event.state && event.state.__modalSentinel) {
        return;
      }
      closedViaBack.current = true;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (!closedViaBack.current) {
        // Defer history.back() by one macrotask. StrictMode's cleanup→remount
        // is synchronous, so the remount will cancel this timer before it fires.
        // A real UI close has no following remount, so the timer fires and pops
        // the sentinel with no phantom entries and no async race.
        cleanupTimer.current = setTimeout(() => {
          cleanupTimer.current = null;
          if (history.state?.__modalSentinel) history.back();
        }, 0);
      }
    };
  }, [isOpen]); // onClose intentionally excluded — kept current via onCloseRef
}
