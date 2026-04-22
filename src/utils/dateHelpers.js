// src/utils/dateHelpers.js
import dayjs from 'dayjs';
import { MISSION_STATUS } from '../types/Mission';

// Helper to normalize different date formats to dayjs
const normalizeDateToDayjs = (date) => {
  if (!date) return null;
  
  // Handle empty strings (from your schema default)
  if (date === '') return null;
  
  // Handle Firestore timestamps
  if (date.toDate) return dayjs(date.toDate());
  
  // Handle Date objects and strings
  return dayjs(date);
};

// Convert dates to string format w/o mins or seconds
export const toDateString = (date) => {
  if (!date) {
    throw new Error('toDateString requires a date argument');
  }
  const normalized = normalizeDateToDayjs(date);
  return normalized.format('YYYY-MM-DD');
};

// Return dayJS object from date string
export const fromDateString = (dateString) => {
  return dayjs(dateString, 'YYYY-MM-DD');
};

// Format for user display - short format
export const formatForUser = (dateString) => {
  const date = normalizeDateToDayjs(dateString);
  if (!date) return null;
  return date.format('MMM D'); // "Jan 15"
};

// Format for user display - long format
export const formatForUserLong = (date) => {
  const normalized = normalizeDateToDayjs(date);
  if (!normalized) return null;
  return normalized.format('MMM D, YYYY'); // "Jan 15, 2024"
};

// Format due date with special handling for today/overdue
export const formatDueDateForUser = (mission) => {
  if (!mission.dueDate || mission.dueDate === '') return null;
  
  if (isMissionDueToday(mission)) return 'Due Today';
  if (isMissionOverdue(mission)) return 'Overdue';
  
  return formatForUser(mission.dueDate);
};

// Get due date status for CSS classes
export const getDueDateStatus = (mission) => {
  if (!mission.dueDate || mission.dueDate === '') return null;
  
  if (isMissionOverdue(mission)) return 'overdue';
  if (isMissionDueToday(mission)) return 'due-today';
  return 'upcoming';
};

// Check if mission is overdue
export const isMissionOverdue = (mission) => {
  if (!mission.dueDate || mission.dueDate === '' || mission.status === MISSION_STATUS.COMPLETED) {
    return false;
  }

  const dueDate = normalizeDateToDayjs(mission.dueDate);
  return dueDate.isBefore(dayjs(), 'day');
};

// Check if mission is due today
export const isMissionDueToday = (mission) => {
  if (!mission.dueDate || mission.dueDate === '' || mission.status === MISSION_STATUS.COMPLETED) {
    return false;
  }
  
  const dueDate = normalizeDateToDayjs(mission.dueDate);
  return dueDate.isSame(dayjs(), 'day');
};

// Check if mission is due tomorrow
export const isMissionDueTomorrow = (mission) => {
  if (!mission.dueDate || mission.dueDate === '' || mission.status === MISSION_STATUS.COMPLETED) {
    return false;
  }

  const tomorrow = dayjs().add(1, 'day');
  const dueDate = normalizeDateToDayjs(mission.dueDate);

  return dueDate.isSame(tomorrow, 'day');
};

// ─── Weekly review helpers ────────────────────────────────────────────────────

const WEEK_START_DAY_NUMBERS = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

// Convert a weekStartDay string ('monday') to a day-of-week number (1)
export const getWeekStartDayNumber = (weekStartDay) => {
  return WEEK_START_DAY_NUMBERS[weekStartDay?.toLowerCase()] ?? 1; // default Monday
};

// Returns { startDate, endDate } as 'YYYY-MM-DD' strings for the week containing `date`
export const getWeekBoundsForDate = (date, weekStartDay) => {
  const startNum = getWeekStartDayNumber(weekStartDay);
  const d = normalizeDateToDayjs(date) ?? dayjs();
  const todayNum = d.day(); // 0=Sun … 6=Sat
  const daysSinceStart = (todayNum - startNum + 7) % 7;
  const weekStart = d.subtract(daysSinceStart, 'day');
  const weekEnd = weekStart.add(6, 'day');
  return {
    startDate: weekStart.format('YYYY-MM-DD'),
    endDate: weekEnd.format('YYYY-MM-DD'),
  };
};

// Returns { startDate, endDate } for the current week
export const getWeekBounds = (weekStartDay) => {
  return getWeekBoundsForDate(dayjs(), weekStartDay);
};

// Returns true if today falls in the weekly review window:
//   from 2 days before week end through 3 days after week end (5-day window)
export const isInWeeklyReviewWindow = (weekStartDay) => {
  const { endDate } = getWeekBounds(weekStartDay);
  const weekEnd = dayjs(endDate);
  const today = dayjs();
  const windowStart = weekEnd.subtract(2, 'day');
  const windowEnd = weekEnd.add(3, 'day');
  return !today.isBefore(windowStart, 'day') && !today.isAfter(windowEnd, 'day');
};

// Returns the { startDate, endDate } of the review window for the current week
export const getReviewWindowBounds = (weekStartDay) => {
  const { endDate } = getWeekBounds(weekStartDay);
  const weekEnd = dayjs(endDate);
  return {
    windowStart: weekEnd.subtract(2, 'day').format('YYYY-MM-DD'),
    windowEnd: weekEnd.add(3, 'day').format('YYYY-MM-DD'),
  };
};

// Returns an array of 'YYYY-MM-DD' strings for every day in the upcoming week
// (the 7-day period starting from the next week's start day)
export const getUpcomingWeekDays = (weekStartDay) => {
  const { endDate } = getWeekBounds(weekStartDay);
  const nextWeekStart = dayjs(endDate).add(1, 'day');
  return Array.from({ length: 7 }, (_, i) =>
    nextWeekStart.add(i, 'day').format('YYYY-MM-DD')
  );
};

// Format a week range for display, e.g. "Apr 14 – 20" or "Apr 28 – May 4"
export const formatWeekRange = (startDate, endDate) => {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  if (start.month() === end.month()) {
    return `${start.format('MMM D')} – ${end.format('D')}`;
  }
  return `${start.format('MMM D')} – ${end.format('MMM D')}`;
};