// src/components/missions/sub-components/RecurrenceSelector.js
import React, { useState } from 'react';
import './recurrenceSelector.css';

const RECURRENCE_PATTERNS = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly', 
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  CUSTOM: 'custom'
};

const WEEKDAYS = [
  { value: 0, label: 'S', full: 'Sunday' },
  { value: 1, label: 'M', full: 'Monday' },
  { value: 2, label: 'T', full: 'Tuesday' },
  { value: 3, label: 'W', full: 'Wednesday' },
  { value: 4, label: 'T', full: 'Thursday' },
  { value: 5, label: 'F', full: 'Friday' },
  { value: 6, label: 'S', full: 'Saturday' }
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
  const [showCustomOptions, setShowCustomOptions] = useState(false);

  const handlePatternChange = (pattern) => {
    let newRecurrence = {
        ...recurrence,
        pattern,
        interval: 1
    };

    // Set smart defaults based on pattern and due date
    if (pattern === RECURRENCE_PATTERNS.WEEKLY && dueDate) {
        const dueDateObj = new Date(dueDate);
        newRecurrence.weekdays = [dueDateObj.getDay()];
    } else if (pattern === RECURRENCE_PATTERNS.MONTHLY && dueDate) {
        const dueDateObj = new Date(dueDate);
        newRecurrence.dayOfMonth = dueDateObj.getDate();
    } else if (pattern === RECURRENCE_PATTERNS.NONE) {
        newRecurrence = {
        pattern: RECURRENCE_PATTERNS.NONE,
        interval: 1,
        weekdays: [],
        dayOfMonth: null,
        endDate: null,
        maxOccurrences: null
        };
        setShowCustomOptions(false);
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

  const getRecurrenceLabel = () => {
  if (recurrence.pattern === RECURRENCE_PATTERNS.NONE) return null;

  const { pattern, interval, weekdays } = recurrence;
  switch (pattern) {
      case RECURRENCE_PATTERNS.DAILY:
        return interval === 1 ? 'Daily' : `Every ${interval} days`;
      
      case RECURRENCE_PATTERNS.WEEKLY:
        if (weekdays.length === 0) return 'Weekly';
        if (weekdays.length === 7) return interval === 1 ? 'Daily' : `Every ${interval} weeks`;
        
        const dayNames = weekdays.map(day => WEEKDAYS[day].label).join('');
        return interval === 1 ? `Weekly (${dayNames})` : `Every ${interval} weeks (${dayNames})`;
      
      case RECURRENCE_PATTERNS.MONTHLY:
        return interval === 1 ? 'Monthly' : `Every ${interval} months`;
      
      case RECURRENCE_PATTERNS.YEARLY:
        return interval === 1 ? 'Yearly' : `Every ${interval} years`;
      
      default:
        return 'Custom';
    }
};

const showWeekdayPicker = recurrence.pattern === RECURRENCE_PATTERNS.WEEKLY && recurrence.pattern !== RECURRENCE_PATTERNS.NONE;
const showIntervalPicker = recurrence.pattern !== RECURRENCE_PATTERNS.NONE && (recurrence.interval > 1 || showCustomOptions);

  return (
    <div className="recurrence-selector-compact">
      
      {/* Main Dropdown */}
      <div className="recurrence-main">
        <label>Repeat</label>
        <select
          value={recurrence.pattern}
          onChange={(e) => handlePatternChange(e.target.value)}
          className="recurrence-select"
          disabled={disabled}
        >
          <option value={RECURRENCE_PATTERNS.NONE}>Does not repeat</option>
          <option value={RECURRENCE_PATTERNS.DAILY}>Daily</option>
          <option value={RECURRENCE_PATTERNS.WEEKLY}>Weekly</option>
          <option value={RECURRENCE_PATTERNS.MONTHLY}>Monthly</option>
          <option value={RECURRENCE_PATTERNS.YEARLY}>Yearly</option>
        </select>

        {/* Show current pattern as compact label */}
        {recurrence.isRecurring && (
          <span className="recurrence-label">{getRecurrenceLabel()}</span>
        )}
      </div>

      {/* Weekday Picker (only for weekly) */}
      {showWeekdayPicker && (
        <div className="weekday-picker-compact">
          <span className="picker-label">On:</span>
          <div className="weekday-buttons-compact">
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => handleWeekdayToggle(day.value)}
                className={`weekday-btn-compact ${recurrence.weekdays.includes(day.value) ? 'selected' : ''}`}
                disabled={disabled}
                title={day.full}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom Interval Picker */}
      {showIntervalPicker && (
        <div className="interval-picker-compact">
          <span className="picker-label">Every:</span>
          <input
            type="number"
            min="1"
            max="365"
            value={recurrence.interval}
            onChange={(e) => handleIntervalChange(e.target.value)}
            className="interval-input-compact"
            disabled={disabled}
          />
          <span className="interval-unit-compact">
            {recurrence.pattern === RECURRENCE_PATTERNS.DAILY ? 'day(s)' :
             recurrence.pattern === RECURRENCE_PATTERNS.WEEKLY ? 'week(s)' :
             recurrence.pattern === RECURRENCE_PATTERNS.MONTHLY ? 'month(s)' :
             recurrence.pattern === RECURRENCE_PATTERNS.YEARLY ? 'year(s)' : ''}
          </span>
        </div>
      )}

      {/* Custom Options Toggle */}
      {recurrence.pattern !== RECURRENCE_PATTERNS.NONE && (
        <div className="custom-options-toggle">
            <button
            type="button"
            onClick={() => setShowCustomOptions(!showCustomOptions)}
            className="toggle-btn-compact"
            disabled={disabled}
            >
            {showCustomOptions ? 'Less options' : 'More options'}
            </button>
        </div>
        )}
        
      {/* Advanced Options (collapsed by default) */}
      {showCustomOptions && recurrence.pattern !== RECURRENCE_PATTERNS.NONE && (
        <div className="advanced-options-compact">
          
          <div className="end-options-compact">
            <div className="end-main-row">
              <label>Ends:</label>
              <select
                value={
                  recurrence.endDate ? 'date' :
                  recurrence.maxOccurrences ? 'count' : 'never'
                }
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'never') {
                    onRecurrenceChange({
                      ...recurrence,
                      endDate: null,
                      maxOccurrences: null
                    });
                  } else if (value === 'date') {
                    onRecurrenceChange({
                      ...recurrence,
                      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      maxOccurrences: null
                    });
                  } else if (value === 'count') {
                    onRecurrenceChange({
                      ...recurrence,
                      maxOccurrences: 10,
                      endDate: null
                    });
                  }
                }}
                className="end-select-compact"
                disabled={disabled}
              >
                <option value="never">Never</option>
                <option value="date">On date</option>
                <option value="count">After # times</option>
              </select>
            </div>

            {/* End Date Input */}
            {recurrence.endDate && (
              <input
                type="date"
                value={recurrence.endDate}
                onChange={(e) => onRecurrenceChange({
                  ...recurrence,
                  endDate: e.target.value
                })}
                className="end-date-input-compact"
                disabled={disabled}
              />
            )}

            {/* Max Occurrences Input */}
            {recurrence.maxOccurrences && (
              <div className="max-occurrences-compact">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={recurrence.maxOccurrences}
                  onChange={(e) => onRecurrenceChange({
                    ...recurrence,
                    maxOccurrences: parseInt(e.target.value) || 1
                  })}
                  className="max-occurrences-input-compact"
                  disabled={disabled}
                />
                <span>times</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {errors.recurrence && (
        <div className="error-text-compact">{errors.recurrence}</div>
      )}
    </div>
  );
};

export default RecurrenceSelector;
export { RECURRENCE_PATTERNS };