// src/components/missions/sub-components/RecurrenceSelector.js
import React from 'react';
import './recurrenceSelector.css';
import { RECURRENCE_PATTERNS, formatRecurrence } from '../../../utils/recurrenceHelpers';

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
        newRecurrence.monthlyMode = 'dayOfMonth';
        newRecurrence.dayOfMonth = dueDateObj.getDate();
        newRecurrence.weekOfMonth = null;
        newRecurrence.weekdayOfMonth = null;
    } else if (pattern === RECURRENCE_PATTERNS.NONE) {
        newRecurrence = {
        pattern: RECURRENCE_PATTERNS.NONE,
        interval: 1,
        weekdays: [],
        monthlyMode: 'dayOfMonth',
        dayOfMonth: null,
        weekOfMonth: null,
        weekdayOfMonth: null,
        endDate: null,
        maxOccurrences: null
        };
    }

    onRecurrenceChange(newRecurrence);
    };

  const handleMonthlyModeChange = (mode) => {
    if (mode === 'dayOfWeek') {
      // Derive defaults from due date so the user sees a sensible starting
      // point (e.g. due 2026-06-12 → "second Friday").
      const base = dueDate ? new Date(dueDate) : new Date();
      const weekdayOfMonth = base.getDay();
      const ordinalGuess = Math.ceil(base.getDate() / 7);
      // The 5th occurrence doesn't exist in every month — treat it as "last".
      const weekOfMonth = ordinalGuess > 4 ? -1 : ordinalGuess;
      onRecurrenceChange({
        ...recurrence,
        monthlyMode: 'dayOfWeek',
        weekOfMonth,
        weekdayOfMonth,
      });
    } else {
      const base = dueDate ? new Date(dueDate) : new Date();
      onRecurrenceChange({
        ...recurrence,
        monthlyMode: 'dayOfMonth',
        dayOfMonth: recurrence.dayOfMonth || base.getDate(),
      });
    }
  };

  const handleDayOfMonthChange = (value) => {
    const parsed = parseInt(value, 10);
    onRecurrenceChange({
      ...recurrence,
      dayOfMonth: Number.isNaN(parsed) ? '' : Math.max(1, Math.min(31, parsed)),
    });
  };

  const handleWeekOfMonthChange = (value) => {
    onRecurrenceChange({ ...recurrence, weekOfMonth: parseInt(value, 10) });
  };

  const handleIntervalChange = (interval) => {
    // Allow temporarily-invalid values (empty, 0) during editing so the user
    // can delete the existing digit before typing a new one. Submit-time
    // validation (validateMission) rejects interval < 1, so bad values never
    // hit the recurrence engine.
    const parsed = parseInt(interval, 10);
    onRecurrenceChange({
      ...recurrence,
      interval: Number.isNaN(parsed) ? '' : parsed
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

  const recurrenceLabel = formatRecurrence(recurrence, { verbose: true });

  const intervalUnit = (() => {
    const plural = recurrence.interval > 1;
    switch (recurrence.pattern) {
      case RECURRENCE_PATTERNS.DAILY:   return plural ? 'days' : 'day';
      case RECURRENCE_PATTERNS.WEEKLY:  return plural ? 'weeks' : 'week';
      case RECURRENCE_PATTERNS.MONTHLY: return plural ? 'months' : 'month';
      case RECURRENCE_PATTERNS.YEARLY:  return plural ? 'years' : 'year';
      default: return '';
    }
  })();

const patternSelected = recurrence.pattern !== RECURRENCE_PATTERNS.NONE;
const showWeekdayPicker = recurrence.pattern === RECURRENCE_PATTERNS.WEEKLY;
const showMonthlyOptions = recurrence.pattern === RECURRENCE_PATTERNS.MONTHLY;
const monthlyMode = recurrence.monthlyMode || 'dayOfMonth';

  return (
    <div className="recurrence-selector-compact">
      
      {/* Main Dropdown */}
      <div className="recurrence-main">
        <label>Repeat:</label>
        <select
          value={recurrence.pattern}
          onChange={(e) => handlePatternChange(e.target.value)}
          className="recurrence-select"
          disabled={disabled}
        >
          <option value={RECURRENCE_PATTERNS.DAILY}>Every day</option>
          <option value={RECURRENCE_PATTERNS.WEEKLY}>Every week</option>
          <option value={RECURRENCE_PATTERNS.MONTHLY}>Every month</option>
          <option value={RECURRENCE_PATTERNS.YEARLY}>Every year</option>
        </select>

        {/* Show current pattern as compact label */}
        {recurrence.isRecurring && recurrenceLabel && (
          <span className="recurrence-label">{recurrenceLabel}</span>
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

      {/* Monthly options — swap between day-of-month and day-of-week patterns */}
      {showMonthlyOptions && (
        <div className="monthly-options-compact">
          <span className="picker-label">On:</span>
          <select
            value={monthlyMode}
            onChange={(e) => handleMonthlyModeChange(e.target.value)}
            className="monthly-mode-select"
            disabled={disabled}
          >
            <option value="dayOfMonth">Day of month</option>
            <option value="dayOfWeek">Day of week</option>
          </select>

          {monthlyMode === 'dayOfMonth' ? (
            <input
              type="number"
              min="1"
              max="31"
              value={recurrence.dayOfMonth ?? ''}
              onChange={(e) => handleDayOfMonthChange(e.target.value)}
              className="monthly-day-input"
              disabled={disabled}
            />
          ) : (
            <>
              <select
                value={recurrence.weekOfMonth ?? 1}
                onChange={(e) => handleWeekOfMonthChange(e.target.value)}
                className="monthly-week-select"
                disabled={disabled}
              >
                <option value={1}>First</option>
                <option value={2}>Second</option>
                <option value={3}>Third</option>
                <option value={4}>Fourth</option>
                <option value={-1}>Last</option>
              </select>
              <span className="monthly-weekday-locked">
                {WEEKDAYS[recurrence.weekdayOfMonth ?? (dueDate ? new Date(dueDate).getDay() : new Date().getDay())]?.full}
              </span>
            </>
          )}
        </div>
      )}

      {/* Interval Picker */}
      {patternSelected && (
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
          <span className="interval-unit-compact">{intervalUnit}</span>
        </div>
      )}

      {/* End Condition */}
      {patternSelected && (
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