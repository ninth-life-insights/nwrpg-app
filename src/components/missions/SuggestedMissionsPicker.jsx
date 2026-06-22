// src/components/missions/SuggestedMissionsPicker.jsx
//
// Shared multi-select picker for suggested missions. Used by:
//   - RoomPage (after a new room is created, filtered by room icon)
//   - Routine builder (filtered by routine context)
//   - Anywhere else that wants "pick a few from a curated list"
//
// Renders as a centered modal sheet (same shape family as TutorialOverlay).
// Callers provide the suggestions array (pre-filtered) and an onAdd handler
// that does the actual createMission calls. This component is purely UI.

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Badge from '../ui/Badge';
import StickyFooter from '../ui/StickyFooter';
import './SuggestedMissionsPicker.css';

const SuggestedMissionsPicker = ({
  open,
  title = 'Suggested missions',
  subtitle = null,
  suggestions = [],
  onClose,
  onAdd, // (selectedSuggestions: Suggestion[]) => Promise<void> | void
  ctaLabel = 'Add selected',
  emptyMessage = 'No suggestions available for this surface.',
}) => {
  const [selectedIndices, setSelectedIndices] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const toggle = (idx) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedIndices.size === 0) return;
    setSubmitting(true);
    setError(null);
    const selected = [...selectedIndices].map(i => suggestions[i]);
    try {
      await onAdd?.(selected);
      onClose?.();
    } catch (e) {
      console.error('Failed to add suggested missions:', e);
      setError("Those didn't save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onPanelClick = (e) => e.stopPropagation();

  return createPortal(
    <div className="suggested-missions-overlay" onClick={onClose}>
      <div className="suggested-missions-panel" onClick={onPanelClick}>
        <div className="suggested-missions-header-row">
          <button
            type="button"
            className="suggested-missions-close"
            aria-label="Close"
            onClick={onClose}
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="suggested-missions-content">
          <h2 className="suggested-missions-title">{title}</h2>
          {subtitle && <p className="suggested-missions-subtitle">{subtitle}</p>}

          {suggestions.length === 0 ? (
            <p className="suggested-missions-empty">{emptyMessage}</p>
          ) : (
            <ul className="suggested-missions-list">
              {suggestions.map((s, i) => {
                const selected = selectedIndices.has(i);
                return (
                  <li
                    key={`${s.title}-${i}`}
                    className={`suggested-missions-row${selected ? ' selected' : ''}`}
                    onClick={() => toggle(i)}
                  >
                    <div className="suggested-missions-row-text">
                      <div className="suggested-missions-row-title">{s.title}</div>
                      <div className="suggested-missions-row-badges">
                        <Badge variant="difficulty" difficulty={s.difficulty}>
                          {s.difficulty}
                        </Badge>
                      </div>
                    </div>
                    <span
                      className={`suggested-missions-check${selected ? ' selected' : ''}`}
                      aria-hidden="true"
                    >
                      {selected && (
                        <span className="material-icons">check</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {suggestions.length > 0 && (
          <StickyFooter bgColor="var(--color-bg-white)">
            {error && (
              <div className="suggested-missions-error">{error}</div>
            )}
            <button
              type="button"
              className="suggested-missions-cta"
              onClick={handleAdd}
              disabled={submitting || selectedIndices.size === 0}
            >
              {submitting
                ? 'Adding...'
                : selectedIndices.size === 0
                  ? ctaLabel
                  : `${ctaLabel} (${selectedIndices.size})`}
            </button>
          </StickyFooter>
        )}
      </div>
    </div>,
    document.body
  );
};

export default SuggestedMissionsPicker;
