import { ENTIRE_BASE_ROOM_ID } from '../services/roomService';
import { isCleanlinessStale } from './cleanlinessHelpers';

export const ROOM_SORT_DEFAULT = 'custom';

export const applyRoomSort = (rooms, sortBy = ROOM_SORT_DEFAULT) => {
  const entireBase = rooms.find(r => r.id === ENTIRE_BASE_ROOM_ID);
  const others = rooms.filter(r => r.id !== ENTIRE_BASE_ROOM_ID);

  let sorted;
  switch (sortBy) {
    case 'name':
      sorted = [...others].sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'overdue':
      sorted = [...others].sort((a, b) => {
        const overdueDiff = (b.stats?.overdue ?? 0) - (a.stats?.overdue ?? 0);
        if (overdueDiff !== 0) return overdueDiff;
        return (b.stats?.total ?? 0) - (a.stats?.total ?? 0);
      });
      break;
    case 'cleanliness': {
      // Fresh rooms sorted lowest cleanliness first; stale rooms (unknown
      // current state) sink to the bottom, sorted among themselves the same way.
      const fresh = others.filter(r => !isCleanlinessStale(r));
      const stale = others.filter(r => isCleanlinessStale(r));
      const byCleanliness = (a, b) => (a.cleanliness ?? 3) - (b.cleanliness ?? 3);
      sorted = [...fresh.sort(byCleanliness), ...stale.sort(byCleanliness)];
      break;
    }
    case 'custom':
    default:
      sorted = [...others].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  return entireBase ? [entireBase, ...sorted] : sorted;
};
