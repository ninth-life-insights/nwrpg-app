// src/components/achievements/CreateCustomAchievementModal.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createCustomAchievement } from '../../services/achievementService';
import { BUILDER_BADGE_COLORS, BUILDER_SYMBOLS } from '../../data/achievementDefinitions';
import './CreateCustomAchievementModal.css';

const COLOR_KEYS = Object.keys(BUILDER_BADGE_COLORS);
const N = BUILDER_SYMBOLS.length;

const CreateCustomAchievementModal = ({ onClose, onCreated }) => {
  const { currentUser } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [symbolIndex, setSymbolIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedSymbol = BUILDER_SYMBOLS[symbolIndex];
  const trackRef = useRef(null);

  // Programmatically scroll the track to center a given index
  const scrollToIndex = useCallback((index) => {
    const track = trackRef.current;
    if (!track) return;
    const slotW = track.offsetWidth / 3;
    track.scrollTo({ left: index * slotW, behavior: 'smooth' });
  }, []);

  // After each native snap, sync the scroll position back to React state
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const handleScrollEnd = () => {
      const slotW = track.offsetWidth / 3;
      const newIndex = Math.round(track.scrollLeft / slotW);
      setSymbolIndex(Math.max(0, Math.min(N - 1, newIndex)));
    };
    track.addEventListener('scrollend', handleScrollEnd);
    return () => track.removeEventListener('scrollend', handleScrollEnd);
  }, []);

  const handlePrev = () => {
    const next = Math.max(0, symbolIndex - 1);
    setSymbolIndex(next);
    scrollToIndex(next);
  };

  const handleNext = () => {
    const next = Math.min(N - 1, symbolIndex + 1);
    setSymbolIndex(next);
    scrollToIndex(next);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Give your win a name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const achievement = await createCustomAchievement(currentUser.uid, {
        name: name.trim(),
        description: description.trim(),
        badgeColor: selectedColor,
        badgeSymbol: selectedSymbol,
      });
      onCreated(achievement);
    } catch (err) {
      console.error('Error saving custom achievement:', err);
      setError('Something went wrong. Try again.');
      setSaving(false);
    }
  };

  return (
    <div className="custom-achievement-overlay" onClick={handleBackdropClick}>
      <div className="custom-achievement-modal">

        {/* Header */}
        <div className="custom-achievement-header">
          <h2 className="custom-achievement-title">Record a Win</h2>
          <button className="custom-achievement-close" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="custom-achievement-body">

          {/* Badge carousel */}
          <div className="custom-achievement-preview">
            <div className="badge-carousel">
              <button
                className="badge-carousel__arrow"
                onClick={handlePrev}
                disabled={symbolIndex === 0}
                aria-label="Previous symbol"
              >
                <span className="material-icons">chevron_left</span>
              </button>

              <div className="badge-carousel__stage">
                {/* Badge background — fixed, never scrolls, updates on color change */}
                <img
                  className="badge-carousel__badge-bg"
                  src={`/assets/Achievement-Builder/achievement_builder_badge_${selectedColor}.png`}
                  alt=""
                  draggable={false}
                />
                {/* Symbol strip — native scroll snapping over the badge */}
                <div className="badge-carousel__track" ref={trackRef}>
                  <div className="badge-carousel__spacer" aria-hidden="true" />
                  {BUILDER_SYMBOLS.map((sym, i) => (
                    <div
                      key={sym}
                      className={`badge-carousel__slot${i === symbolIndex ? ' badge-carousel__slot--active' : ''}`}
                    >
                      <img
                        src={`/assets/Achievement-Builder/achievement_builder_symbol_${sym}.png`}
                        alt={sym}
                        draggable={false}
                      />
                    </div>
                  ))}
                  <div className="badge-carousel__spacer" aria-hidden="true" />
                </div>
              </div>

              <button
                className="badge-carousel__arrow"
                onClick={handleNext}
                disabled={symbolIndex === N - 1}
                aria-label="Next symbol"
              >
                <span className="material-icons">chevron_right</span>
              </button>
            </div>
            <p className="custom-achievement-preview-name">{name || 'Your Win'}</p>
          </div>

          {/* Name */}
          <div className="custom-achievement-field">
            <label className="custom-achievement-label" htmlFor="win-name">Name</label>
            <input
              id="win-name"
              className="custom-achievement-input"
              type="text"
              placeholder="e.g. Potty training victory"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="custom-achievement-field">
            <label className="custom-achievement-label" htmlFor="win-description">
              Note <span className="custom-achievement-optional">(optional)</span>
            </label>
            <textarea
              id="win-description"
              className="custom-achievement-textarea"
              placeholder="A little context for future you..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
            />
          </div>

          {/* Color picker */}
          <div className="custom-achievement-field">
            <label className="custom-achievement-label">Badge Color</label>
            <div className="custom-achievement-colors">
              {COLOR_KEYS.map(color => (
                <button
                  key={color}
                  className={`color-swatch${selectedColor === color ? ' color-swatch--selected' : ''}`}
                  style={{
                    backgroundColor: BUILDER_BADGE_COLORS[color].bg,
                    borderColor: selectedColor === color ? '#374151' : 'transparent',
                  }}
                  onClick={() => setSelectedColor(color)}
                  aria-label={color}
                />
              ))}
            </div>
          </div>

          {error && <p className="custom-achievement-error">{error}</p>}
        </div>

        {/* Footer */}
        <div className="custom-achievement-footer">
          <button className="custom-achievement-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="custom-achievement-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Record Win'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default CreateCustomAchievementModal;
