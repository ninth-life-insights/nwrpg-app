// src/components/achievements/CreateCustomAchievementModal.jsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createCustomAchievement } from '../../services/achievementService';
import { BUILDER_BADGE_COLORS, BUILDER_SYMBOLS } from '../../data/achievementDefinitions';
import AchievementBadge from './AchievementBadge';
import './CreateCustomAchievementModal.css';

const COLOR_KEYS = Object.keys(BUILDER_BADGE_COLORS);

const CreateCustomAchievementModal = ({ onClose, onCreated }) => {
  const { currentUser } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [selectedSymbol, setSelectedSymbol] = useState('star');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

          {/* Live preview */}
          <div className="custom-achievement-preview">
            <AchievementBadge color={selectedColor} badgeSymbol={selectedSymbol} size="lg" />
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

          {/* Symbol picker */}
          <div className="custom-achievement-field">
            <label className="custom-achievement-label">Badge Symbol</label>
            <div className="custom-achievement-symbols">
              {BUILDER_SYMBOLS.map(symbol => (
                <button
                  key={symbol}
                  className={`symbol-option${selectedSymbol === symbol ? ' symbol-option--selected' : ''}`}
                  onClick={() => setSelectedSymbol(symbol)}
                  aria-label={symbol}
                >
                  <img
                    src={`/assets/Achievement-Builder/achievement_builder_symbol_${symbol}.png`}
                    alt={symbol}
                  />
                </button>
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
