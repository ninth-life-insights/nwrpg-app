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
  // Saved so cleanup can restore history to the pre-sentinel state synchronously.
  const prevState = useRef(null);
  // Keep onClose in a ref so it's always current without being a dep.
  // Without this, an inline-arrow onClose prop causes the effect to re-run on
  // every parent re-render (including React Router's own popstate responses),
  // producing extra effect cycles that call history.back() at the wrong position.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    closedViaBack.current = false;
    prevState.current = history.state;

    // Push a sentinel entry at the same URL so back button has something to pop.
    // Using location.href keeps the URL identical so React Router won't navigate.
    console.log('[useModalBackButton] OPEN — pushing sentinel. url:', location.href, 'history.length:', history.length, 'current state:', JSON.stringify(history.state));
    history.pushState({ __modalSentinel: true }, '', location.href);
    console.log('[useModalBackButton] sentinel pushed. history.length now:', history.length);

    const handlePopState = (event) => {
      console.log('[useModalBackButton] popstate fired. event.state:', JSON.stringify(event.state), 'url:', location.href);
      // If we've landed on another sentinel, this was triggered by a nested
      // modal's cleanup — don't close this modal.
      if (event.state && event.state.__modalSentinel) {
        console.log('[useModalBackButton] ignoring (landed on nested sentinel)');
        return;
      }
      console.log('[useModalBackButton] closing modal via back');
      closedViaBack.current = true;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      console.log('[useModalBackButton] CLEANUP. closedViaBack:', closedViaBack.current, 'url:', location.href, 'history.length:', history.length, 'state:', JSON.stringify(history.state));
      window.removeEventListener('popstate', handlePopState);
      if (!closedViaBack.current) {
        // Modal was closed via UI — replace the sentinel with the saved pre-push
        // state. replaceState is synchronous and fires no popstate, so there is
        // no async race and React Router is not disturbed.
        console.log('[useModalBackButton] replaceState to remove sentinel. restoring:', JSON.stringify(prevState.current));
        history.replaceState(prevState.current, '', location.href);
      } else {
        console.log('[useModalBackButton] closed via back — sentinel already consumed');
      }
    };
  }, [isOpen]); // onClose intentionally excluded — kept current via onCloseRef
}
