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