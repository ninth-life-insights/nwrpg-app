// src/utils/weeklyReviewHelpers.js
import dayjs from 'dayjs';

/**
 * Given the user's chosen week-start day (0=Sun, 1=Mon, ... 6=Sat),
 * returns information about the current weekly review window.
 *
 * Grace window: 2 days before weekStartDay through weekStartDay (3 days total).
 * e.g. weekStartDay=1 (Mon) → eligible on Sat, Sun, Mon.
 *
 * @param {number} weekStartDay - 0–6
 * @returns {{
 *   isEligible: boolean,
 *   reviewedWeekStart: dayjs,  // the week just ended (7 days before nextWeekStart)
 *   reviewedWeekEnd: dayjs,    // day before nextWeekStart
 *   nextWeekStart: dayjs,      // the upcoming week's start date
 * }}
 */
export const getWeeklyReviewInfo = (weekStartDay = 1) => {
  const today = dayjs();
  const todayDOW = today.day(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilWeekStart = (weekStartDay - todayDOW + 7) % 7;
  const nextWeekStart = today.add(daysUntilWeekStart, 'day');
  const graceWindowStart = nextWeekStart.subtract(2, 'day');

  const isEligible =
    !today.isBefore(graceWindowStart, 'day') &&
    !today.isAfter(nextWeekStart, 'day');

  return {
    isEligible,
    reviewedWeekStart: nextWeekStart.subtract(7, 'day'),
    reviewedWeekEnd: nextWeekStart.subtract(1, 'day'),
    nextWeekStart,
  };
};

/**
 * Returns an array of `count` dayjs objects starting from `startDate`.
 * Used to generate the 7-day accordion in WeekPlanningStep.
 *
 * @param {dayjs} startDate
 * @param {number} count
 * @returns {dayjs[]}
 */
export const getWeekDates = (startDate, count = 7) => {
  return Array.from({ length: count }, (_, i) => startDate.add(i, 'day'));
};

/**
 * Formats a week range for display headers and adventure log cards.
 * e.g. "Apr 14 – Apr 20"
 *
 * @param {dayjs} weekStart
 * @param {dayjs} weekEnd
 * @returns {string}
 */
export const formatWeekLabel = (weekStart, weekEnd) => {
  const startStr = weekStart.format('MMM D');
  const endStr = weekEnd.format('MMM D');
  return `${startStr} – ${endStr}`;
};

/**
 * Day-of-week names for the week-start-day picker.
 * Index matches dayjs .day() values (0=Sun, 1=Mon, ..., 6=Sat).
 */
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
