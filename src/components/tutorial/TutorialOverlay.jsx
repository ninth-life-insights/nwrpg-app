// src/components/tutorial/TutorialOverlay.jsx
//
// Portal-rendered overlay shown when TutorialContext has an active step.
// Supports three variants per screen:
//   - 'story':     centered modal panel with title/body/CTA
//   - 'spotlight': dimmed backdrop with a cutout over one or more target
//                  elements (clip-path), instruction panel positioned near it
//   - 'wait':      no UI; TutorialContext watches an event and advances
//
// Spotlight `target` can be:
//   - string:    one data-tutorial-target value
//   - string[]:  multiple values, unioned into one bounding rect
//   - function:  receives the activeStep and returns string | string[].
//                Use when the target id depends on runtime data captured by
//                an earlier wait screen (e.g. the new mission's id).
//
// Spotlight click behavior depends on the screen config:
//   - no ctaLabel:           target click → advance; off-target → dismiss
//   - has ctaLabel:          clicks pass through; the user must use the CTA
//                            or X (lets them interact with form fields
//                            inside a modal without dismissing the tutorial)
//   - waitForCompletion:     clicks pass through; the spotlight stays put
//                            until an external watcher (e.g., the Phase 1
//                            mission-completion watcher) clears activeStep.
//                            Only the X button can dismiss
//
// If a spotlight target disappears mid-screen (e.g. the user closes the
// modal it was pointing at), `revertOnTargetLoss` on the screen causes the
// tutorial to step back N screens via TutorialContext.revertScreens(n).
// Without it, the renderer falls back to story rendering of the same screen.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTutorial } from '../../contexts/TutorialContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { requestPermission } from '../../services/notificationService';
import { getNotificationPrefs, saveNotificationPrefs } from '../../services/notificationPrefsService';
import './TutorialOverlay.css';

// How long to keep retrying to find a spotlight target before falling back
// to story rendering. Most pages mount well within this window.
const SPOTLIGHT_TARGET_RETRY_MS = 1500;

// Hard cap on the rect-stabilization poll. If the target's rect hasn't
// settled within this window (e.g. a continuously animating element), accept
// whatever rect we have rather than leaving the spotlight invisible forever.
const SPOTLIGHT_STABILIZE_TIMEOUT_MS = 1000;

// Per-side tolerance when comparing rects across frames for stabilization.
const SPOTLIGHT_STABILIZE_TOLERANCE_PX = 1;

// Padding around the spotlight cutout so the target doesn't touch the dim.
const SPOTLIGHT_PADDING = 8;

// Approximate panel height used for placement decisions. Doesn't need to be
// exact — the panel auto-sizes; this is just for "does it fit below or above."
const APPROX_PANEL_HEIGHT = 200;

// Compute the union bounding rect of a list of elements. Returns null for
// an empty list. Used so a single spotlight cutout can cover several
// adjacent UI elements (e.g. a difficulty selector + a type selector).
const unionRect = (els) => {
  if (!els.length) return null;
  let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.top < top) top = r.top;
    if (r.left < left) left = r.left;
    if (r.right > right) right = r.right;
    if (r.bottom > bottom) bottom = r.bottom;
  }
  return { top, left, right, bottom, width: right - left, height: bottom - top };
};

const StoryRenderer = ({ screen, ctaLabel, onPrimary, onSecondary, dismiss }) => (
  <div className="tutorial-overlay" onClick={dismiss}>
    <div className="tutorial-panel" onClick={(e) => e.stopPropagation()}>
      <div className="tutorial-header-row">
        <button
          type="button"
          className="tutorial-close"
          aria-label="Close tutorial"
          onClick={dismiss}
        >
          <span className="material-icons">close</span>
        </button>
      </div>
      <div className="tutorial-content">
        {screen.title && <h2 className="tutorial-title">{screen.title}</h2>}
        {Array.isArray(screen.body)
          ? screen.body.map((p, i) => (
              <p key={i} className="tutorial-body">{p}</p>
            ))
          : screen.body && <p className="tutorial-body">{screen.body}</p>}
      </div>
      <div className="tutorial-actions">
        <button type="button" className="tutorial-cta" onClick={onPrimary}>
          {ctaLabel}
        </button>
        {screen.secondaryLabel && (
          <button type="button" className="tutorial-cta-secondary" onClick={onSecondary}>
            {screen.secondaryLabel}
          </button>
        )}
      </div>
    </div>
  </div>
);

const SpotlightRenderer = ({
  screen,
  targets,
  ctaLabel,
  advance,
  dismiss,
  onFallback,
  onTargetLost,
  signalExpectedRouteChange,
}) => {
  const [targetEls, setTargetEls] = useState([]);
  const [targetRect, setTargetRect] = useState(null);

  // Stable key so the find-effect re-runs when the target list changes but
  // not on every render. JSON.stringify is fine here — the array is short
  // and effectively constant for a given screen.
  const targetsKey = useMemo(() => JSON.stringify(targets), [targets]);

  // Locate all targets. Retries on each animation frame until all are found
  // or until the fallback timer fires. `found` is a local flag rather than
  // reading targetEls from the closure (which would always be the stale
  // empty array from initial render).
  useEffect(() => {
    let mounted = true;
    let rafId = null;
    let fallbackTimer = null;
    let found = false;

    if (!targets.length) {
      // Dynamic target resolved to nothing — fall back immediately so the
      // user still sees the lesson.
      fallbackTimer = setTimeout(() => mounted && onFallback(), 0);
      return () => {
        mounted = false;
        if (fallbackTimer) clearTimeout(fallbackTimer);
      };
    }

    const tryFind = () => {
      if (!mounted || found) return;
      const els = targets
        .map(t => document.querySelector(`[data-tutorial-target="${t}"]`))
        .filter(Boolean);
      if (els.length === targets.length) {
        found = true;
        setTargetEls(els);
        if (fallbackTimer) clearTimeout(fallbackTimer);
        return;
      }
      rafId = requestAnimationFrame(tryFind);
    };
    tryFind();

    fallbackTimer = setTimeout(() => {
      if (mounted && !found) onFallback();
    }, SPOTLIGHT_TARGET_RETRY_MS);

    return () => {
      mounted = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetsKey]);

  // Once we have the targets, stabilize the rect before exposing it. The
  // first getBoundingClientRect() can land mid-animation (e.g., the bottom-
  // sheet modal slide-up, mobile address bar collapsing, or webfonts still
  // loading), which would render the cutout at the wrong position and then
  // "hop" when a later resize/scroll/font event re-measured. We poll on
  // rAF until two consecutive frames return the same rect within a small
  // tolerance, then publish it and attach the long-term watchers.
  useEffect(() => {
    if (!targetEls.length) return;

    let cancelled = false;
    let settled = false;
    let rafId = null;
    let prevRect = null;
    let ro = null;

    const measure = () => setTargetRect(unionRect(targetEls));

    const rectsMatch = (a, b) => {
      if (!a || !b) return false;
      const tol = SPOTLIGHT_STABILIZE_TOLERANCE_PX;
      return Math.abs(a.top - b.top) <= tol
        && Math.abs(a.left - b.left) <= tol
        && Math.abs(a.right - b.right) <= tol
        && Math.abs(a.bottom - b.bottom) <= tol;
    };

    const onSettled = () => {
      if (cancelled || settled) return;
      settled = true;
      if (rafId) cancelAnimationFrame(rafId);
      measure();
      ro = new ResizeObserver(measure);
      targetEls.forEach(el => ro.observe(el));
      window.addEventListener('scroll', measure, { capture: true, passive: true });
      window.addEventListener('resize', measure);
    };

    const stabilize = () => {
      if (cancelled || settled) return;
      const r = unionRect(targetEls);
      if (prevRect && rectsMatch(prevRect, r)) {
        onSettled();
        return;
      }
      prevRect = r;
      rafId = requestAnimationFrame(stabilize);
    };
    stabilize();

    const fallbackTimer = setTimeout(onSettled, SPOTLIGHT_STABILIZE_TIMEOUT_MS);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(fallbackTimer);
      if (ro) ro.disconnect();
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
    };
  }, [targetEls]);

  // Watch for any tracked element being removed from the DOM (e.g. the user
  // closed the modal it was pointing at). MutationObserver on body subtree
  // is cheap enough — it only fires on real mutations.
  useEffect(() => {
    if (!targetEls.length) return;
    const check = () => {
      if (targetEls.some(el => !el.isConnected)) {
        onTargetLost();
      }
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [targetEls, onTargetLost]);

  // Document-level click handler. Backdrop is pointer-events: none so the
  // user can interact with anything during the spotlight. Behavior splits
  // on whether the screen has an explicit CTA:
  //   - no CTA: click on target advances; click elsewhere dismisses
  //   - has CTA: clicks pass through to the underlying UI; only the CTA or
  //              X button can advance/dismiss. Lets the user manipulate
  //              form fields inside a modal without losing the spotlight.
  const panelRef = useRef(null);
  useEffect(() => {
    if (!targetEls.length) return;
    if (ctaLabel) return; // CTA mode — no automatic advance/dismiss
    if (screen.waitForCompletion) return; // Watcher-driven — same idea
    const handleDocClick = (e) => {
      if (targetEls.some(el => el.contains(e.target))) {
        // If the target click is expected to trigger app navigation
        // (e.g. tapping a card that links to a detail page), pre-arm the
        // route-change watcher so it lets the transition through instead
        // of dismissing the overlay.
        if (screen.expectsRouteChangeOnAdvance) {
          signalExpectedRouteChange();
        }
        advance();
        return;
      }
      if (panelRef.current && panelRef.current.contains(e.target)) {
        return;
      }
      dismiss();
    };
    // Capture phase so we run before any stopPropagation calls deeper in
    // the tree could swallow the event from our reach.
    document.addEventListener('click', handleDocClick, true);
    return () => document.removeEventListener('click', handleDocClick, true);
  }, [targetEls, ctaLabel, screen.waitForCompletion, screen.expectsRouteChangeOnAdvance, advance, dismiss, signalExpectedRouteChange]);

  // While we're still hunting for the targets, render an invisible placeholder
  // so the parent doesn't try to mount story-variant in the meantime.
  if (!targetRect) {
    return <div className="tutorial-spotlight-loading" aria-hidden="true" />;
  }

  // Pad the cutout slightly so the target has some visual breathing room.
  const cutout = {
    top: Math.max(targetRect.top - SPOTLIGHT_PADDING, 0),
    left: Math.max(targetRect.left - SPOTLIGHT_PADDING, 0),
    right: Math.min(targetRect.right + SPOTLIGHT_PADDING, window.innerWidth),
    bottom: Math.min(targetRect.bottom + SPOTLIGHT_PADDING, window.innerHeight),
  };

  // clip-path polygon with the viewport outline + a counter-clockwise hole
  // around the target rect. Even-odd fill rule (default for clip-path
  // polygon) creates the cutout.
  const clipPath = [
    `0 0`,
    `100% 0`,
    `100% 100%`,
    `0 100%`,
    `0 0`,
    `${cutout.left}px ${cutout.top}px`,
    `${cutout.left}px ${cutout.bottom}px`,
    `${cutout.right}px ${cutout.bottom}px`,
    `${cutout.right}px ${cutout.top}px`,
    `${cutout.left}px ${cutout.top}px`,
  ].join(', ');

  // Position the panel below the cutout if there's room, above if not,
  // anchored to viewport bottom otherwise.
  const vh = window.innerHeight;
  const spaceBelow = vh - cutout.bottom;
  const spaceAbove = cutout.top;
  let panelStyle;
  if (spaceBelow >= APPROX_PANEL_HEIGHT + 32) {
    panelStyle = { top: cutout.bottom + 16, bottom: 'auto' };
  } else if (spaceAbove >= APPROX_PANEL_HEIGHT + 32) {
    panelStyle = { bottom: vh - cutout.top + 16, top: 'auto' };
  } else {
    panelStyle = { bottom: 24, top: 'auto' };
  }

  return (
    <>
      <div
        className="tutorial-spotlight-backdrop"
        style={{ clipPath: `polygon(${clipPath})` }}
      />
      <div className="tutorial-spotlight-panel" style={panelStyle} ref={panelRef}>
        <div className="tutorial-header-row">
          <button
            type="button"
            className="tutorial-close"
            aria-label="Close tutorial"
            onClick={dismiss}
          >
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="tutorial-content">
          {screen.title && <h2 className="tutorial-title">{screen.title}</h2>}
          {Array.isArray(screen.body)
            ? screen.body.map((p, i) => (
                <p key={i} className="tutorial-body">{p}</p>
              ))
            : screen.body && <p className="tutorial-body">{screen.body}</p>}
        </div>
        {ctaLabel && (
          <div className="tutorial-actions">
            <button type="button" className="tutorial-cta" onClick={advance}>
              {ctaLabel}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

const TutorialOverlay = () => {
  const {
    activeStep,
    advance,
    dismiss,
    revertScreens,
    signalExpectedRouteChange,
  } = useTutorial();
  const { currentUser } = useAuth();
  const { refreshSchedule } = useNotifications();

  // Notification opt-in for a story screen with ctaAction: 'enable-notifications'.
  // Runs the same path as Settings (request permission → save prefs → re-arm
  // the schedule), then advances regardless of the outcome so the tutorial is
  // never blocked. Flips only the master switch and keeps every category at its
  // default-on state — turning on a subset would be confusing when the user
  // later opens Settings and finds some categories silently off.
  const handleEnableNotifications = useCallback(async () => {
    try {
      if (typeof Notification !== 'undefined' && currentUser) {
        const result = await requestPermission();
        if (result === 'granted') {
          const prefs = await getNotificationPrefs(currentUser.uid);
          await saveNotificationPrefs(currentUser.uid, {
            ...prefs,
            enabled: true,
          });
          await refreshSchedule();
        }
      }
    } catch (e) {
      console.error('Tutorial notification opt-in failed:', e);
    }
    advance();
  }, [currentUser, refreshSchedule, advance]);
  // When a spotlight screen can't find its target, we flip this flag and
  // re-render the same screen as story instead. Resets when the screen
  // changes.
  const [fallback, setFallback] = useState(false);
  const stepKey = `${activeStep?.missionId ?? 'none'}-${activeStep?.screenIndex ?? 0}`;
  const lastKeyRef = useRef(stepKey);
  if (lastKeyRef.current !== stepKey) {
    lastKeyRef.current = stepKey;
    if (fallback) setFallback(false);
  }

  // Resolve the spotlight target list. Strings and arrays pass through;
  // functions are called with the current activeStep so they can read
  // runtime context (e.g. a mission id captured by a wait screen).
  const resolvedTargets = useMemo(() => {
    const screen = activeStep?.screens?.[activeStep.screenIndex];
    if (!screen || screen.variant !== 'spotlight') return [];
    const raw = typeof screen.target === 'function'
      ? screen.target(activeStep)
      : screen.target;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }, [activeStep]);

  if (!activeStep) return null;
  const screen = activeStep.screens[activeStep.screenIndex];
  if (!screen) return null;

  // Wait state — render no UI. TutorialContext watches for the event and
  // auto-advances when it fires.
  if (screen.variant === 'wait') return null;

  const isLast = activeStep.screenIndex >= activeStep.screens.length - 1;
  const useSpotlight = screen.variant === 'spotlight' && !fallback;

  // Story always has a CTA (it's the only way to advance). Spotlight gates
  // the user on clicking the target by default — only shows a CTA when the
  // screen explicitly declares one (use for "look at this, no click needed").
  const ctaLabel = useSpotlight
    ? (screen.ctaLabel ?? null)
    : (screen.ctaLabel || (isLast ? 'Got it' : 'Continue'));

  return createPortal(
    useSpotlight ? (
      <SpotlightRenderer
        screen={screen}
        targets={resolvedTargets}
        ctaLabel={ctaLabel}
        advance={advance}
        dismiss={dismiss}
        signalExpectedRouteChange={signalExpectedRouteChange}
        onFallback={() => setFallback(true)}
        onTargetLost={() => {
          const n = screen.revertOnTargetLoss ?? 0;
          if (n > 0) revertScreens(n);
          else setFallback(true);
        }}
      />
    ) : (
      <StoryRenderer
        screen={screen}
        ctaLabel={ctaLabel}
        onPrimary={screen.ctaAction === 'enable-notifications' ? handleEnableNotifications : advance}
        onSecondary={advance}
        dismiss={dismiss}
      />
    ),
    document.body
  );
};

export default TutorialOverlay;
