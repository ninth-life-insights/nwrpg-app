// src/components/rooms/HomeTemplatePicker.jsx
//
// Modal picker for batch-creating rooms from a named home template
// ("Studio", "2 bed 1 bath", etc.). Renders the templates as selectable
// cards. On confirm, calls the supplied onApply handler with the chosen
// template — caller handles the actual write (via roomService.createRoomsBatch).

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import StickyFooter from '../ui/StickyFooter';
import { HOME_TEMPLATES } from '../../data/homeTemplates';
import './HomeTemplatePicker.css';

const HomeTemplatePicker = ({
  open,
  onClose,
  onApply, // (template) => Promise<void> | void
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const handleSelect = (templateId) => {
    setSelectedId(templateId);
    setExpandedId(prev => (prev === templateId ? null : templateId));
  };

  const handleApply = async () => {
    const template = HOME_TEMPLATES.find(t => t.id === selectedId);
    if (!template) return;
    setSubmitting(true);
    setError(null);
    try {
      await onApply?.(template);
      onClose?.();
    } catch (e) {
      console.error('Home template apply failed:', e);
      setError("Those rooms didn't save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

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
            You can edit, rename, or delete any room afterwards.
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

        <StickyFooter bgColor="var(--color-bg-white)">
          {error && (
            <div className="home-template-error">{error}</div>
          )}
          <button
            type="button"
            className="home-template-cta"
            onClick={handleApply}
            disabled={submitting || !selectedId}
          >
            {submitting ? 'Creating rooms...' : 'Use this template'}
          </button>
        </StickyFooter>
      </div>
    </div>,
    document.body
  );
};

export default HomeTemplatePicker;
