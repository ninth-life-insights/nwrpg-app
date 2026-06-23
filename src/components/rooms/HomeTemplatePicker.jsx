// src/components/rooms/HomeTemplatePicker.jsx
//
// Modal picker for batch-creating rooms from a named home template
// ("Studio", "2 bed 1 bath", etc.). Renders the templates as selectable
// cards. On confirm, calls the supplied onApply handler with the chosen
// template — caller handles the actual write (via roomService.createRoomsBatch).

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { HOME_TEMPLATES } from '../../data/homeTemplates';
import './HomeTemplatePicker.css';

const HomeTemplatePicker = ({
  open,
  onClose,
  onApply, // (template) => Promise<void> | void
  // When true, hitting "Use this template" first shows an inline confirm
  // step rather than applying immediately. Caller passes true when the
  // user already has custom rooms, so they don't accidentally append
  // duplicate rooms to a configured base.
  confirmBeforeApply = false,
  existingRoomCount = 0,
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  if (!open) return null;

  const selectedTemplate = HOME_TEMPLATES.find(t => t.id === selectedId);

  const handleSelect = (templateId) => {
    setSelectedId(templateId);
    setExpandedId(prev => (prev === templateId ? null : templateId));
  };

  const handleCtaClick = () => {
    if (!selectedTemplate) return;
    if (confirmBeforeApply && !awaitingConfirm) {
      setAwaitingConfirm(true);
      return;
    }
    runApply();
  };

  const runApply = async () => {
    if (!selectedTemplate) return;
    setSubmitting(true);
    setError(null);
    try {
      await onApply?.(selectedTemplate);
      onClose?.();
    } catch (e) {
      console.error('Home template apply failed:', e);
      setError("Those rooms didn't save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelConfirm = () => setAwaitingConfirm(false);

  const onPanelClick = (e) => e.stopPropagation();

  return createPortal(
    <div className="home-template-overlay" onClick={onClose}>
      <div className="home-template-panel" onClick={onPanelClick}>
        <div className="home-template-header-row">
          <button
            type="button"
            className="home-template-close"
            aria-label="Close"
            onClick={onClose}
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="home-template-content">
          <h2 className="home-template-title">Pick a home template</h2>
          <p className="home-template-subtitle">
            Start your base with a set of rooms that matches your place.
            You can rename, edit, delete, or add more rooms afterwards.
          </p>

          <ul className="home-template-list">
            {HOME_TEMPLATES.map(template => {
              const selected = selectedId === template.id;
              const expanded = expandedId === template.id;
              return (
                <li
                  key={template.id}
                  className={`home-template-card${selected ? ' selected' : ''}`}
                  onClick={() => handleSelect(template.id)}
                >
                  <div className="home-template-card-header">
                    <div className="home-template-card-text">
                      <div className="home-template-card-name">{template.name}</div>
                      <div className="home-template-card-meta">
                        {template.rooms.length} rooms
                      </div>
                      {template.description && (
                        <div className="home-template-card-desc">
                          {template.description}
                        </div>
                      )}
                    </div>
                    <span
                      className={`home-template-radio${selected ? ' selected' : ''}`}
                      aria-hidden="true"
                    >
                      {selected && (
                        <span className="material-icons">check</span>
                      )}
                    </span>
                  </div>

                  {expanded && (
                    <ul className="home-template-room-list">
                      {template.rooms.map((room, i) => (
                        <li key={`${room.name}-${i}`} className="home-template-room">
                          <span className="home-template-room-bullet" aria-hidden="true">·</span>
                          <span className="home-template-room-name">{room.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="home-template-footer">
          {error && (
            <div className="home-template-error">{error}</div>
          )}

          {awaitingConfirm ? (
            <>
              <div className="home-template-confirm-warning">
                You already have {existingRoomCount} {existingRoomCount === 1 ? 'room' : 'rooms'}.
                Applying <strong>{selectedTemplate?.name}</strong> will add its
                {' '}{selectedTemplate?.rooms.length} rooms alongside, which can
                create duplicates (you can rename or delete any after).
              </div>
              <div className="home-template-confirm-actions">
                <button
                  type="button"
                  className="home-template-cta home-template-cta-secondary"
                  onClick={cancelConfirm}
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="home-template-cta"
                  onClick={runApply}
                  disabled={submitting}
                >
                  {submitting ? 'Adding...' : 'Add rooms anyway'}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="home-template-cta"
              onClick={handleCtaClick}
              disabled={submitting || !selectedId}
            >
              {submitting ? 'Creating rooms...' : 'Use this template'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default HomeTemplatePicker;
