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
import './SuggestedMissionsPicker.css';

const SuggestedMissionsPicker = ({
  open,
  title = 'Suggested missions',
  subtitle = null,
  suggestions = [],
  // Optional filter chips. Each: { key, label, predicate?: (s) => boolean }.
  // A chip with no predicate matches every suggestion (use for "All").
  filterOptions = null,
  initialFilterKey = null,
  onClose,
  onAdd, // (selectedSuggestions: Suggestion[]) => Promise<void> | void
  ctaLabel = 'Add selected',
  emptyMessage = 'No suggestions available for this surface.',
}) => {
  // Selection tracked by suggestion object reference so changing the
  // active filter doesn't invalidate the user's picks.
  const [selectedSuggestions, setSelectedSuggestions] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilterKey, setActiveFilterKey] = useState(
    initialFilterKey ?? filterOptions?.[0]?.key ?? null
  );

  if (!open) return null;

  // Apply the active filter's predicate, if any.
  const activeFilter = filterOptions?.find(f => f.key === activeFilterKey) ?? null;
  const visibleSuggestions = activeFilter?.predicate
    ? suggestions.filter(activeFilter.predicate)
    : suggestions;

  const toggle = (suggestion) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(suggestion)) next.delete(suggestion);
      else next.add(suggestion);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedSuggestions.size === 0) return;
    setSubmitting(true);
    setError(null);
    const selected = [...selectedSuggestions];
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

          {filterOptions && filterOptions.length > 0 && (
            <div className="suggested-missions-filters" role="tablist">
              {filterOptions.map(f => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={activeFilterKey === f.key}
                  className={`suggested-missions-filter-chip${activeFilterKey === f.key ? ' active' : ''}`}
                  onClick={() => setActiveFilterKey(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {visibleSuggestions.length === 0 ? (
            <p className="suggested-missions-empty">{emptyMessage}</p>
          ) : (
            <ul className="suggested-missions-list">
              {visibleSuggestions.map((s, i) => {
                const selected = selectedSuggestions.has(s);
                return (
                  <li
                    key={`${s.title}-${i}`}
                    className={`suggested-missions-row${selected ? ' selected' : ''}`}
                    onClick={() => toggle(s)}
                  >
                    <div className="suggested-missions-row-text">
                      <div className="suggested-missions-row-title">{s.title}</div>
                      <div className="suggested-missions-row-badges">
                        <Badge variant="difficulty" difficulty={s.difficulty}>
                          {s.difficulty}
                        </Badge>
                        {s.skill && (
                          <Badge variant="skill">{s.skill}</Badge>
                        )}
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
          <div className="suggested-missions-footer">
            {error && (
              <div className="suggested-missions-error">{error}</div>
            )}
            <button
              type="button"
              className="suggested-missions-cta"
              onClick={handleAdd}
              disabled={submitting || selectedSuggestions.size === 0}
            >
              {submitting
                ? 'Adding...'
                : selectedSuggestions.size === 0
                  ? ctaLabel
                  : `${ctaLabel} (${selectedSuggestions.size})`}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default SuggestedMissionsPicker;
