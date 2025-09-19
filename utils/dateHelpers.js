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

