// src/components/missions/sub-components/RecurrenceSelector.js
import React, { useState } from 'react';
import './RecurrenceSelector.css';

const RECURRENCE_PATTERNS = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly', 
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  CUSTOM: 'custom'
};

const WEEKDAYS = [
  { value: 0, label: 'Sun', full: 'Sunday' },
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
  { value: 6, label: 'Sat', full: 'Saturday' }
];

const RecurrenceSelector = ({
  recurrence = {
    isRecurring: false,
    pattern: RECURRENCE_PATTERNS.NONE,
    interval: 1,
    weekdays: [],
    dayOfMonth: null,
    endDate: null,
    maxOccurrences: null
  },
  onRecurrenceChange,
  dueDate,
  disabled = false,
  errors = {}
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handlePatternChange = (pattern) => {
    let newRecurrence = {
      ...recurrence,
      pattern,
      isRecurring: pattern !== RECURRENCE_PATTERNS.NONE
    };

    // Set defaults based on pattern
    if (pattern === RECURRENCE_PATTERNS.WEEKLY && dueDate) {
      const dueDateObj = new Date(dueDate);
      newRecurrence.weekdays = [dueDateObj.getDay()];
    } else if (pattern === RECURRENCE_PATTERNS.MONTHLY && dueDate) {
      const dueDateObj = new Date(dueDate);
      newRecurrence.dayOfMonth = dueDateObj.getDate();
    } else if (pattern === RECURRENCE_PATTERNS.NONE) {
      // Reset to defaults when turning off recurrence
      newRecurrence = {
        isRecurring: false,
        pattern: RECURRENCE_PATTERNS.NONE,
        interval: 1,
        weekdays: [],
        dayOfMonth: null,
        endDate: null,
        maxOccurrences: null
      };
    }

    onRecurrenceChange(newRecurrence);
  };

  const handleIntervalChange = (interval) => {
    onRecurrenceChange({
      ...recurrence,
      interval: Math.max(1, parseInt(interval) || 1)
    });
  };

  const handleWeekdayToggle = (dayValue) => {
    const newWeekdays = recurrence.weekdays.includes(dayValue)
      ? recurrence.weekdays.filter(day => day !== dayValue)
      : [...recurrence.weekdays, dayValue].sort();
    
    onRecurrenceChange({
      ...recurrence,
      weekdays: newWeekdays
    });
  };

  const handleDayOfMonthChange = (day) => {
    onRecurrenceChange({
      ...recurrence,
      dayOfMonth: parseInt(day) || null
    });
  };

  const getRecurrencePreview = () => {
    if (!recurrence.isRecurring) return null;

    const { pattern, interval, weekdays, dayOfMonth } = recurrence;

    switch (pattern) {
      case RECURRENCE_PATTERNS.DAILY:
        return interval === 1 ? 'Every day' : `Every ${interval} days`;
      
      case RECURRENCE_PATTERNS.WEEKLY:
        if (weekdays.length === 0) return 'Weekly (no days selected)';
        if (weekdays.length === 7) return interval === 1 ? 'Every day' : `Every ${interval} weeks`;
        
        const dayNames = weekdays.map(day => WEEKDAYS[day].label).join(', ');
        const weekText = interval === 1 ? 'Every' : `Every ${interval}`;
        return `${weekText} ${dayNames}`;
      
      case RECURRENCE_PATTERNS.MONTHLY:
        const monthText = interval === 1 ? 'Monthly' : `Every ${interval} months`;
        if (dayOfMonth) {
          return `${monthText} on the ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}`;
        }
        return `${monthText} on the same day`;
      
      case RECURRENCE_PATTERNS.YEARLY:
        return interval === 1 ? 'Yearly' : `Every ${interval} years`;
      
      default:
        return 'Custom recurrence';
    }
  };

  const getOrdinalSuffix = (num) => {
    const remainder = num % 10;
    const teen = Math.floor(num / 10) % 10;
    if (teen === 1) return 'th';
    if (remainder === 1) return 'st';
    if (remainder === 2) return 'nd';
    if (remainder === 3) return 'rd';
    return 'th';
  };

  const isPatternSelected = (pattern) => recurrence.pattern === pattern;

  return (
    <div className="recurrence-selector">
      
      {/* Basic Pattern Selection */}
      <div className="pattern-selector">
        <div className="pattern-buttons">
          <button
            type="button"
            onClick={() => handlePatternChange(RECURRENCE_PATTERNS.NONE)}
            className={`pattern-btn ${isPatternSelected(RECURRENCE_PATTERNS.NONE) ? 'selected' : ''}`}
            disabled={disabled}
          >
            One-time
          </button>
          
          <button
            type="button"
            onClick={() => handlePatternChange(RECURRENCE_PATTERNS.DAILY)}
            className={`pattern-btn ${isPatternSelected(RECURRENCE_PATTERNS.DAILY) ? 'selected' : ''}`}
            disabled={disabled}
          >
            Daily
          </button>
          
          <button
            type="button"
            onClick={() => handlePatternChange(RECURRENCE_PATTERNS.WEEKLY)}
            className={`pattern-btn ${isPatternSelected(RECURRENCE_PATTERNS.WEEKLY) ? 'selected' : ''}`}
            disabled={disabled}
          >
            Weekly
          </button>
          
          <button
            type="button"
            onClick={() => handlePatternChange(RECURRENCE_PATTERNS.MONTHLY)}
            className={`pattern-btn ${isPatternSelected(RECURRENCE_PATTERNS.MONTHLY) ? 'selected' : ''}`}
            disabled={disabled}
          >
            Monthly
          </button>
          
          <button
            type="button"
            onClick={() => handlePatternChange(RECURRENCE_PATTERNS.YEARLY)}
            className={`pattern-btn ${isPatternSelected(RECURRENCE_PATTERNS.YEARLY) ? 'selected' : ''}`}
            disabled={disabled}
          >
            Yearly
          </button>
        </div>
      </div>

      {/* Pattern-specific Options */}
      {recurrence.isRecurring && (
        <div className="recurrence-options">
          
          {/* Interval Selection for non-weekly patterns */}
          {recurrence.pattern !== RECURRENCE_PATTERNS.WEEKLY && (
            <div className="interval-section">
              <label>Repeat every</label>
              <div className="interval-input-group">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={recurrence.interval}
                  onChange={(e) => handleIntervalChange(e.target.value)}
                  className="interval-input"
                  disabled={disabled}
                />
                <span className="interval-unit">
                  {recurrence.pattern === RECURRENCE_PATTERNS.DAILY ? 'day(s)' :
                   recurrence.pattern === RECURRENCE_PATTERNS.MONTHLY ? 'month(s)' :
                   recurrence.pattern === RECURRENCE_PATTERNS.YEARLY ? 'year(s)' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Weekly Day Selection */}
          {recurrence.pattern === RECURRENCE_PATTERNS.WEEKLY && (
            <div className="weekday-section">
              <label>Repeat on</label>
              <div className="weekday-buttons">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleWeekdayToggle(day.value)}
                    className={`weekday-btn ${recurrence.weekdays.includes(day.value) ? 'selected' : ''}`}
                    disabled={disabled}
                    title={day.full}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {recurrence.interval > 1 && (
                <div className="interval-section weekly-interval">
                  <label>Every</label>
                  <div className="interval-input-group">
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={recurrence.interval}
                      onChange={(e) => handleIntervalChange(e.target.value)}
                      className="interval-input"
                      disabled={disabled}
                    />
                    <span className="interval-unit">week(s)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Monthly Day Selection */}
          {recurrence.pattern === RECURRENCE_PATTERNS.MONTHLY && (
            <div className="monthly-section">
              <label>On day</label>
              <input
                type="number"
                min="1"
                max="31"
                value={recurrence.dayOfMonth || ''}
                onChange={(e) => handleDayOfMonthChange(e.target.value)}
                className="day-input"
                placeholder="Same day as due date"
                disabled={disabled}
              />
              <span className="helper-text">Leave blank to use the same day as the due date</span>
            </div>
          )}

          {/* Recurrence Preview */}
          <div className="recurrence-preview">
            <span className="preview-label">Repeats:</span>
            <span className="preview-text">{getRecurrencePreview()}</span>
          </div>

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="advanced-toggle"
            disabled={disabled}
          >
            {showAdvanced ? 'Hide' : 'Show'} advanced options
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="advanced-options">
              
              <div className="end-condition-section">
                <label>End recurrence</label>
                
                <div className="end-option">
                  <label>
                    <input
                      type="radio"
                      name="endType"
                      checked={!recurrence.endDate && !recurrence.maxOccurrences}
                      onChange={() => onRecurrenceChange({
                        ...recurrence,
                        endDate: null,
                        maxOccurrences: null
                      })}
                      disabled={disabled}
                    />
                    Never
                  </label>
                </div>
                
                <div className="end-option">
                  <label>
                    <input
                      type="radio"
                      name="endType"
                      checked={!!recurrence.endDate}
                      onChange={() => onRecurrenceChange({
                        ...recurrence,
                        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        maxOccurrences: null
                      })}
                      disabled={disabled}
                    />
                    On date
                  </label>
                  {recurrence.endDate && (
                    <input
                      type="date"
                      value={recurrence.endDate}
                      onChange={(e) => onRecurrenceChange({
                        ...recurrence,
                        endDate: e.target.value
                      })}
                      className="end-date-input"
                      disabled={disabled}
                    />
                  )}
                </div>
                
                <div className="end-option">
                  <label>
                    <input
                      type="radio"
                      name="endType"
                      checked={!!recurrence.maxOccurrences}
                      onChange={() => onRecurrenceChange({
                        ...recurrence,
                        maxOccurrences: 10,
                        endDate: null
                      })}
                      disabled={disabled}
                    />
                    After
                  </label>
                  {recurrence.maxOccurrences && (
                    <div className="max-occurrences-group">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={recurrence.maxOccurrences}
                        onChange={(e) => onRecurrenceChange({
                          ...recurrence,
                          maxOccurrences: parseInt(e.target.value) || 1
                        })}
                        className="max-occurrences-input"
                        disabled={disabled}
                      />
                      <span>occurrences</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {errors.recurrence && (
        <div className="error-text">{errors.recurrence}</div>
      )}
    </div>
  );
};

export default RecurrenceSelector;
export { RECURRENCE_PATTERNS };