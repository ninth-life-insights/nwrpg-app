// src/components/missions/CompletionTypeSelector.js
import React, { useState, useEffect } from 'react';
import { COMPLETION_TYPES } from '../../../types/Mission';
import './CompletionTypeSelector.css';

const CompletionTypeSelector = ({ 
  completionType, 
  onCompletionTypeChange,
  timerDurationMinutes,
  onTimerDurationChange,
  targetCount,
  onTargetCountChange,
  disabled = false,
  errors = {}
}) => {
  // Timer state - separate hours and minutes for better UX
  const [timerHours, setTimerHours] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(0);

  // Initialize timer values from props, convert extra mins to hours
  useEffect(() => {
    if (timerDurationMinutes) {
      const hours = Math.floor(timerDurationMinutes / 60);
      const minutes = timerDurationMinutes % 60;
      setTimerHours(hours);
      setTimerMinutes(minutes);
    }
  }, [timerDurationMinutes]);

  // Update parent when timer values change
  useEffect(() => {
    const totalMinutes = (timerHours * 60) + timerMinutes;
    if (totalMinutes !== timerDurationMinutes) {
      onTimerDurationChange(totalMinutes || null);
    }
  }, [timerHours, timerMinutes, timerDurationMinutes, onTimerDurationChange]);

  const handleTimerInputChange = (type, value) => {
    const numValue = parseInt(value) || 0;
    if (type === 'hours') {
      setTimerHours(Math.max(0, Math.min(23, numValue))); // Cap at 23 hours
    } else {
      setTimerMinutes(Math.max(0, Math.min(59, numValue))); // Cap at 59 minutes
    }
  };

  const handleCountChange = (increment) => {
    const newCount = Math.max(1, (targetCount || 1) + increment);
    onTargetCountChange(newCount);
  };

  const handleCountInputChange = (value) => {
    const numValue = parseInt(value) || 1;
    onTargetCountChange(Math.max(1, numValue));
  };

  return (
    <div className="completion-type-section">
      <label className="section-label">Completion Type</label>
      
      {/* Segmented Control to select completion type */}
      <div 
        className="completion-type-selector" 
        data-selected={completionType}
      >
        {Object.entries(COMPLETION_TYPES).map(([key, value]) => (
          <label key={value} className="completion-type-option">
            <input
              type="radio"
              name="completionType"
              value={value}
              checked={completionType === value}
              onChange={(e) => onCompletionTypeChange(e.target.value)}
              disabled={disabled}
            />
            <span className="completion-type-label">
              {key.charAt(0) + key.slice(1).toLowerCase()}
            </span>
          </label>
        ))}
      </div>

      {/* Timer Duration Input */}
      {completionType === COMPLETION_TYPES.TIMER && (
        <div className="completion-detail-field">
          <label className="detail-label">Duration *</label>
          <div className="timer-input-group">
            <div className="timer-input-unit">
              <input
                type="number"
                value={timerHours}
                onChange={(e) => handleTimerInputChange('hours', e.target.value)}
                className="timer-input"
                min="0"
                max="23"
                disabled={disabled}
              />
              <span className="timer-unit-label">hrs</span>
            </div>
            <div className="timer-input-unit">
              <input
                type="number"
                value={timerMinutes}
                onChange={(e) => handleTimerInputChange('minutes', e.target.value)}
                className="timer-input"
                min="0"
                max="59"
                disabled={disabled}
              />
              <span className="timer-unit-label">mins</span>
            </div>
          </div>
          {errors.timerDurationMinutes && (
            <span className="error-text">{errors.timerDurationMinutes}</span>
          )}
        </div>
      )}

      {/* Target Count Input */}
      {completionType === COMPLETION_TYPES.COUNT && (
        <div className="completion-detail-field">
          <label className="detail-label">Target Count *</label>
          <div className="count-input-group">
            <button
              type="button"
              className="count-button count-decrease"
              onClick={() => handleCountChange(-1)}
              disabled={disabled || (targetCount || 1) <= 1}
            >
              −
            </button>
            <input
              type="number"
              value={targetCount || 1}
              onChange={(e) => handleCountInputChange(e.target.value)}
              className="count-input"
              min="1"
              disabled={disabled}
            />
            <button
              type="button"
              className="count-button count-increase"
              onClick={() => handleCountChange(1)}
              disabled={disabled}
            >
              +
            </button>
          </div>
          {errors.targetCount && (
            <span className="error-text">{errors.targetCount}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default CompletionTypeSelector;