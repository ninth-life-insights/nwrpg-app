// src/components/achievements/CreateCustomAchievementModal.jsx
import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createCustomAchievement } from '../../services/achievementService';
import { BUILDER_BADGE_COLORS, BUILDER_SYMBOLS } from '../../data/achievementDefinitions';
import './CreateCustomAchievementModal.css';

const COLOR_KEYS = Object.keys(BUILDER_BADGE_COLORS);
const STEP_PX = 65; // pixels of drag required to advance one symbol

const CreateCustomAchievementModal = ({ onClose, onCreated }) => {
  const { currentUser } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [symbolIndex, setSymbolIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const N = BUILDER_SYMBOLS.length;
  const selectedSymbol = BUILDER_SYMBOLS[symbolIndex];

  const dragStartX = useRef(null);
  const didDrag = useRef(false);

  const handlePrev = () => setSymbolIndex(i => (i - 1 + N) % N);
  const handleNext = () => setSymbolIndex(i => (i + 1) % N);

  const handleDragStart = (e) => {
    dragStartX.current = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    didDrag.current = false;
    setDragging(true);
  };

  const handleDragMove = (e) => {
    if (dragStartX.current === null) return;
    const currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const offset = currentX - dragStartX.current;
    if (Math.abs(offset) > 8) didDrag.current = true;
    setDragOffset(offset);
  };

  const handleDragEnd = (e) => {
    if (dragStartX.current === null) return;
    const endX = e.type === 'touchend' ? e.changedTouches[0].clientX : e.clientX;
    const delta = endX - dragStartX.current;
    const steps = -Math.round(delta / STEP_PX);
    if (steps !== 0) setSymbolIndex(i => ((i + steps) % N + N) % N);
    dragStartX.current = null;
    setDragOffset(0);
    setDragging(false);
  };

  const handleSlotClick = (offset) => {
    if (didDrag.current) return;
    if (offset < 0) handlePrev();
    else if (offset > 0) handleNext();
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
              <button className="badge-carousel__arrow" onClick={handlePrev} aria-label="Previous symbol">
                <span className="material-icons">chevron_left</span>
              </button>

              {/* Stage: fixed badge bg + sliding symbol strip */}
              <div
                className="badge-carousel__stage"
                onMouseDown={handleDragStart}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchStart={handleDragStart}
                onTouchMove={handleDragMove}
                onTouchEnd={handleDragEnd}
              >
                {/* Fixed badge background — never moves */}
                <img
                  className="badge-carousel__badge-bg"
                  src={`/assets/Achievement-Builder/achievement_builder_badge_${selectedColor}.png`}
                  alt=""
                  draggable={false}
                />

                {/* Symbol strip — slides over the badge */}
                <div className="badge-carousel__viewport">
                  <div
                    className="badge-carousel__track"
                    style={{
                      transform: `translateX(calc(-20% + ${dragOffset}px))`,
                      transition: dragging ? 'none' : 'transform 0.2s ease',
                    }}
                  >
                    {[-2, -1, 0, 1, 2].map(offset => {
                      const sym = BUILDER_SYMBOLS[((symbolIndex + offset) % N + N) % N];
                      const isCenter = offset === 0;
                      const isFar = Math.abs(offset) === 2;
                      return (
                        <div
                          key={offset}
                          className={`badge-carousel__slot${isCenter ? ' badge-carousel__slot--center' : isFar ? ' badge-carousel__slot--far' : ' badge-carousel__slot--adj'}`}
                          onClick={() => handleSlotClick(offset)}
                        >
                          <img
                            src={`/assets/Achievement-Builder/achievement_builder_symbol_${sym}.png`}
                            alt={sym}
                            draggable={false}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button className="badge-carousel__arrow" onClick={handleNext} aria-label="Next symbol">
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
