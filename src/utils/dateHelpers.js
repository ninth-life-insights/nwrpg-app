// src/utils/dateHelpers.js
import dayjs from 'dayjs';

import { MISSION_STATUS } from '../types/Mission';

//convert dates to string format w/o mins or seconds
export const toDateString = (date) => {
  if (!date) {
    throw new Error('toDateString requires a date argument');
  }
  return dayjs(date).format('YYYY-MM-DD');
};

//return dayJS object from date string
export const fromDateString = (dateString) => {
  return dayjs(dateString, 'YYYY-MM-DD');
};

// Format for user display
export const formatForUser = (dateString) => {
  return dayjs(dateString).format('MMM D'); // "Jan 15, 2024"
};

// check if mission is overdue
export const isMissionOverdue = (mission) => {
  if (!mission.dueDate || mission.status === MISSION_STATUS.COMPLETED) {
    return false;
  }

  return dayjs(mission.dueDate).isBefore(dayjs(), 'day');
};

// check if mission is due today
export const isMissionDueToday = (mission) => {
  if (!mission.dueDate || mission.status === MISSION_STATUS.COMPLETED) {
    
    return false;
  }
  
  return dayjs(mission.dueDate).isSame(dayjs(), 'day');
};

// check if mission is due tomorrow
export const isMissionDueTomorrow = (mission) => {
  if (!mission.dueDate || mission.status === MISSION_STATUS.COMPLETED) {
    
    return false;
  }

  const tomorrow = dayjs().add(1, 'day');
  
  return dayjs(mission.dueDate).isSame(tomorrow, 'day');
};
