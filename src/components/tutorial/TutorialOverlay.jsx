// src/components/tutorial/TutorialOverlay.jsx
//
// Portal-rendered overlay shown when TutorialContext has an active step.
// Supports two variants per screen:
//   - 'story':    centered modal panel with title/body/CTA
//   - 'spotlight': dimmed backdrop with a cutout over a target element
//                  (clip-path), instruction panel positioned near the target
//
// Spotlight screens declare `target: 'data-tutorial-target-value'`. The
// renderer looks up the element via querySelector with rAF retries (handles
// page-still-mounting), then keeps its rect synced via ResizeObserver +
// scroll/resize listeners. If the target can't be found within a short
// retry window, falls back to story rendering so the lesson still lands.

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTutorial } from '../../contexts/TutorialContext';
import './TutorialOverlay.css';

// How long to keep retrying to find a spotlight target before falling back
// to story rendering. Most pages mount well within this window.
const SPOTLIGHT_TARGET_RETRY_MS = 1500;

// Padding around the spotlight cutout so the target doesn't touch the dim.
const SPOTLIGHT_PADDING = 8;

// Approximate panel height used for placement decisions. Doesn't need to be
// exact — the panel auto-sizes; this is just for "does it fit below or above."
const APPROX_PANEL_HEIGHT = 200;

const StoryRenderer = ({ screen, ctaLabel, advance, dismiss }) => (
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
        <button type="button" className="tutorial-cta" onClick={advance}>
          {ctaLabel}
        </button>
      </div>
    </div>
  </div>
);

const SpotlightRenderer = ({ screen, ctaLabel, advance, dismiss, onFallback }) => {
  const [targetEl, setTargetEl] = useState(null);
  const [targetRect, setTargetRect] = useState(null);

  // Locate the target element. Retries on each animation frame until found
  // or until the fallback timer fires. `found` is a local flag rather than
  // reading targetEl from the closure (which would always be the stale
  // null from initial render — that was the original "spotlight flashes
  // then falls back" bug).
  useEffect(() => {
    let mounted = true;
    let rafId = null;
    let fallbackTimer = null;
    let found = false;

    const tryFind = () => {
      if (!mounted || found) return;
      const el = document.querySelector(`[data-tutorial-target="${screen.target}"]`);
      if (el) {
        found = true;
        setTargetEl(el);
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
  }, [screen.target]);

  // Once we have the target, observe size + scroll/resize for rect updates.
  useEffect(() => {
    if (!targetEl) return;
    const measure = () => setTargetRect(targetEl.getBoundingClientRect());
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(targetEl);
    window.addEventListener('scroll', measure, { capture: true, passive: true });
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
    };
  }, [targetEl]);

  // Advance the screen when the user clicks the spotlight target. The
  // click still propagates to the underlying handler, so the action's
  // modal opens cleanly. If the next screen is a `wait` state, the overlay
  // hides until the watched event fires (e.g., new mission created).
  // Otherwise the next prompt renders right away.
  useEffect(() => {
    if (!targetEl) return;
    const handleClick = () => advance();
    targetEl.addEventListener('click', handleClick);
    return () => targetEl.removeEventListener('click', handleClick);
  }, [targetEl, advance]);

  // While we're still hunting for the target, render an invisible placeholder
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
        onClick={dismiss}
      />
      <div className="tutorial-spotlight-panel" style={panelStyle}>
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
  const { activeStep, advance, dismiss } = useTutorial();
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

  if (!activeStep) return null;
  const screen = activeStep.screens[activeStep.screenIndex];
  if (!screen) return null;

  // Wait state — render no UI. TutorialContext watches for the event and
  // auto-advances when it fires.
  if (screen.variant === 'wait') return null;

  const isLast = activeStep.screenIndex >= activeStep.screens.length - 1;
  const useSpotlight = screen.variant === 'spotlight' && screen.target && !fallback;

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
        ctaLabel={ctaLabel}
        advance={advance}
        dismiss={dismiss}
        onFallback={() => setFallback(true)}
      />
    ) : (
      <StoryRenderer
        screen={screen}
        ctaLabel={ctaLabel}
        advance={advance}
        dismiss={dismiss}
      />
    ),
    document.body
  );
};

export default TutorialOverlay;
