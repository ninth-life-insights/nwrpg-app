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
  // Suppresses the popstate fired by our own cleanup's history.back() call.
  // Needed because React StrictMode double-invokes effects: cleanup calls
  // history.back(), then the re-mounted effect registers a new listener which
  // would otherwise catch that popstate and close the modal spuriously.
  const ignoreNextPopState = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    closedViaBack.current = false;

    // Push a sentinel entry at the same URL so back button has something to pop.
    // Using location.href keeps the URL identical so React Router won't navigate.
    history.pushState({ __modalSentinel: true }, '', location.href);

    const handlePopState = (event) => {
      if (ignoreNextPopState.current) {
        ignoreNextPopState.current = false;
        return;
      }
      // If we've landed on another sentinel, this was triggered by a nested
      // modal's cleanup calling history.back() — don't close this modal.
      if (event.state && event.state.__modalSentinel) {
        return;
      }
      closedViaBack.current = true;
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (!closedViaBack.current) {
        // Modal was closed via UI — remove the sentinel entry we pushed.
        // Since the URL doesn't change, React Router won't treat this as navigation.
        ignoreNextPopState.current = true;
        history.back();
      }
    };
  }, [isOpen, onClose]);
}
