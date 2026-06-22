// src/components/tutorial/TutorialOverlay.jsx
//
// Portal-rendered overlay shown when TutorialContext has an active step.
// Phase 2 supports the `story` variant (full-screen explainer). The
// `spotlight` variant (dimmed background with target cutout) lands in a
// follow-up slice — for now spotlight screens fall through to the story
// renderer so the flow still works end-to-end.

import React from 'react';
import { createPortal } from 'react-dom';
import { useTutorial } from '../../contexts/TutorialContext';
import './TutorialOverlay.css';

const TutorialOverlay = () => {
  const { activeStep, advance, dismiss } = useTutorial();

  if (!activeStep) return null;
  const screen = activeStep.screens[activeStep.screenIndex];
  if (!screen) return null;

  const isLast = activeStep.screenIndex >= activeStep.screens.length - 1;
  const ctaLabel = screen.ctaLabel || (isLast ? 'Got it' : 'Continue');

  // Stop propagation on the panel so taps inside it don't dismiss.
  const onPanelClick = (e) => e.stopPropagation();

  return createPortal(
    <div className="tutorial-overlay" onClick={dismiss}>
      <div className="tutorial-panel" onClick={onPanelClick}>
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
          <button
            type="button"
            className="tutorial-cta"
            onClick={advance}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TutorialOverlay;
