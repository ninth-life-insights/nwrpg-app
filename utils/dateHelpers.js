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

export const isMissionOverdue = (mission) => {
  if (!mission.dueDate || mission.status === MISSION_STATUS.COMPLETED) {
    return false;
  };

  const today = dayjs();
  const dueDate = dayjs(mission.dueDate);

  return dayjs(mission.dueDate).isBefore(dayjs(), 'day');
};


// Day-only comparison functions using dayjs unit parameter
export const isSameDate = (date1, date2) => {
  return dayjs(date1).isSame(dayjs(date2), 'day');
};

export const isBeforeDate = (date1, date2) => {
  return dayjs(date1).isBefore(dayjs(date2), 'day');
};

export const isAfterDate = (date1, date2) => {
  return dayjs(date1).isAfter(dayjs(date2), 'day');
};