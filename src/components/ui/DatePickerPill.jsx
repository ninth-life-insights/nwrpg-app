// src/components/ui/DatePickerPill.jsx
import { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { fromDateString } from '../../utils/dateHelpers';
import './DatePickerPill.css';

// Shared date selector — a pill that opens a bottom sheet with Today /
// Tomorrow shortcut buttons and a custom date input. Used by both
// EditDailyMissionsPage ("Plan for...") and the routine today section
// ("View day...") so the two surfaces feel like one consistent control.
//
// Props:
//   value         — current YYYY-MM-DD string
//   onChange      — called with new YYYY-MM-DD string when user selects
//   heading       — sheet title ("Plan for...", "View day...", etc.)
//   minDate       — earliest selectable date (default: today)
//   className     — extra class for the pill (if caller wants additional styling)
const DatePickerPill = ({
  value,
  onChange,
  heading = 'Pick a day',
  minDate,
  className = '',
}) => {
  const [showSheet, setShowSheet] = useState(false);

  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const tomorrow = useMemo(() => dayjs().add(1, 'day').format('YYYY-MM-DD'), []);
  const effectiveMinDate = minDate || today;

  const isToday = value === today;
  const isTomorrow = value === tomorrow;

  const pillLabel = isToday
    ? `Today — ${fromDateString(value).format('ddd, MMM D')}`
    : isTomorrow
    ? `Tomorrow — ${fromDateString(value).format('ddd, MMM D')}`
    : fromDateString(value).format('ddd, MMM D');

  const handleSelect = (date) => {
    onChange?.(date);
    setShowSheet(false);
  };

  return (
    <>
      <button
        type="button"
        className={`date-selector-pill ${!isToday ? 'future' : ''} ${className}`.trim()}
        onClick={() => setShowSheet(true)}
        aria-label="Change date"
      >
        <span className="date-selector-icon">📅</span>
        <span className="date-selector-label">{pillLabel}</span>
        <span className="date-selector-caret">▾</span>
      </button>

      {showSheet && (
        <div
          className="date-picker-overlay"
          onClick={() => setShowSheet(false)}
        >
          <div
            className="date-picker-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="date-picker-heading">{heading}</p>
            <button
              className={`date-picker-option ${value === today ? 'active' : ''}`}
              onClick={() => handleSelect(today)}
            >
              Today — {fromDateString(today).format('ddd, MMM D')}
            </button>
            <button
              className={`date-picker-option ${value === tomorrow ? 'active' : ''}`}
              onClick={() => handleSelect(tomorrow)}
            >
              Tomorrow — {fromDateString(tomorrow).format('ddd, MMM D')}
            </button>
            <div className="date-picker-custom">
              <label
                className="date-picker-custom-label"
                htmlFor="date-picker-pill-custom-input"
              >
                Choose a date
              </label>
              <input
                id="date-picker-pill-custom-input"
                type="date"
                className="date-picker-input"
                min={effectiveMinDate}
                defaultValue={
                  value !== today && value !== tomorrow ? value : ''
                }
                onChange={(e) => {
                  if (e.target.value) handleSelect(e.target.value);
                }}
              />
            </div>
            <button
              className="date-picker-cancel"
              onClick={() => setShowSheet(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default DatePickerPill;
