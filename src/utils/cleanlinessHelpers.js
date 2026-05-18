// src/utils/cleanlinessHelpers.js
import dayjs from 'dayjs';

export const CLEANLINESS_STALE_DAYS = 10;
export const CLEANLINESS_STALE_COLOR = '#9ca3af';

export const CLEANLINESS_LABELS = {
  1: 'Messy',
  2: 'Needs Help',
  3: 'Holding Steady',
  4: 'Clean',
  5: 'Spotless',
};

export const CLEANLINESS_COLORS = {
  1: '#ef4444',
  2: '#f97316',
  3: '#eab308',
  4: '#84cc16',
  5: '#10b981',
};

// Bucket counts for the Entire Base segmented summary. Stale rooms get their
// own bucket since their last-known value may no longer reflect reality.
export const getCleanlinessSummary = (segments) => {
  const byLevel = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let stale = 0;
  segments.forEach(seg => {
    if (seg.stale) stale++;
    else byLevel[seg.cleanliness] = (byLevel[seg.cleanliness] || 0) + 1;
  });
  return { byLevel, stale };
};

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
