// src/utils/cleanlinessHelpers.js
import dayjs from 'dayjs';

export const CLEANLINESS_STALE_DAYS = 0;
export const CLEANLINESS_STALE_COLOR = '#9ca3af';

const toDate = (ts) => {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  return new Date(ts);
};

// Falls back to general updatedAt/createdAt so rooms that pre-date the
// cleanlinessUpdatedAt field don't snap to stale on first load.
export const getCleanlinessTimestamp = (room) => {
  return toDate(room?.cleanlinessUpdatedAt)
      || toDate(room?.updatedAt)
      || toDate(room?.createdAt);
};

export const daysSinceCleanlinessUpdate = (room) => {
  const ts = getCleanlinessTimestamp(room);
  if (!ts) return null;
  return dayjs().diff(dayjs(ts), 'day');
};

export const isCleanlinessStale = (room) => {
  const days = daysSinceCleanlinessUpdate(room);
  if (days === null) return false;
  return days >= CLEANLINESS_STALE_DAYS;
};

export const getCleanlinessStaleLabel = (room) => {
  const days = daysSinceCleanlinessUpdate(room);
  if (days === null) return 'Not checked yet';
  if (days < 1) return 'Checked today';
  if (days === 1) return 'Checked 1 day ago';
  return `Checked ${days} days ago`;
};
