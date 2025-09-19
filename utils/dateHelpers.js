// src/utils/dateHelpers.js
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);


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

// check if mission is overdue
export const isMissionOverdue = (mission) => {
  if (!mission.dueDate || mission.status === MISSION_STATUS.COMPLETED) {
    return false;
  };

  return dayjs(mission.dueDate).isBefore(dayjs(), 'day');
};

// check if mission is due today
export const isMissionDueToday = (mission) => {
  if (!mission.dueDate || mission.status === MISSION_STATUS.COMPLETED) {
    
    return false;
  }
  
  return dayjs(mission.dueDate).isSame(dayjs(), 'day');
};

// check if mission is due today
export const isMissionDueTomorrow = (mission) => {
  if (!mission.dueDate || mission.status === MISSION_STATUS.COMPLETED) {
    
    return false;
  }

  const tomorrow = dayjs().add(1, 'day');
  
  return dayjs(mission.dueDate).isSame(tomorrow, 'day');
};
