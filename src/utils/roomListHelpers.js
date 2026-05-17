import { ENTIRE_BASE_ROOM_ID } from '../services/roomService';

export const ROOM_SORT_DEFAULT = 'custom';

export const applyRoomSort = (rooms, sortBy = ROOM_SORT_DEFAULT) => {
  const entireBase = rooms.find(r => r.id === ENTIRE_BASE_ROOM_ID);
  const others = rooms.filter(r => r.id !== ENTIRE_BASE_ROOM_ID);

  let sorted;
  switch (sortBy) {
    case 'name':
      sorted = [...others].sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'tasks':
      sorted = [...others].sort((a, b) => (b.stats?.total ?? 0) - (a.stats?.total ?? 0));
      break;
    case 'cleanliness':
      sorted = [...others].sort((a, b) => (a.cleanliness ?? 3) - (b.cleanliness ?? 3));
      break;
    case 'custom':
    default:
      sorted = [...others].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  return entireBase ? [entireBase, ...sorted] : sorted;
};
