export const normalizeMissionListFilters = (filters = {}) => ({
  sortBy: filters.sortBy || 'custom',
  sortOrder: filters.sortOrder || 'asc',
  skillFilter: filters.skillFilter || '',
  includeCompleted: filters.includeCompleted || false,
  showArchive: filters.showArchive || false,
  completedDateRange: filters.completedDateRange || 'last7days',
  roomFilter: filters.roomFilter || '',
  taskTypeFilter: filters.taskTypeFilter || '',
  questFilter: filters.questFilter || '',
  priorityFilter: filters.priorityFilter || ''
});

const toJsDate = (value) => {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
};

export const isWithinCompletedDateRange = (mission, dateRange) => {
  if (mission.status !== 'completed' || !mission.completedAt) {
    return false;
  }

  const completedDate = toJsDate(mission.completedAt);
  const now = new Date();

  switch (dateRange) {
    case 'today': {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return completedDate >= today && completedDate < tomorrow;
    }

    case 'last7days': {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return completedDate >= sevenDaysAgo && completedDate <= now;
    }

    case 'last30days': {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      return completedDate >= thirtyDaysAgo && completedDate <= now;
    }

    case 'alltime':
      return true;

    default: {
      const defaultSevenDaysAgo = new Date();
      defaultSevenDaysAgo.setDate(defaultSevenDaysAgo.getDate() - 7);
      defaultSevenDaysAgo.setHours(0, 0, 0, 0);
      return completedDate >= defaultSevenDaysAgo && completedDate <= now;
    }
  }
};

const compareByCreatedAt = (a, b) => {
  const aCreated = toJsDate(a.createdAt);
  const bCreated = toJsDate(b.createdAt);
  return aCreated - bCreated;
};

const compareByDueDate = (a, b) => {
  const aDate = toJsDate(a.dueDate);
  const bDate = toJsDate(b.dueDate);

  if (!aDate && !bDate) return compareByCreatedAt(a, b);
  if (!aDate) return 1;
  if (!bDate) return -1;
  return aDate - bDate;
};

const compareByCustomOrder = (a, b) => {
  const aHasOrder = a.customSortOrder !== null && a.customSortOrder !== undefined;
  const bHasOrder = b.customSortOrder !== null && b.customSortOrder !== undefined;

  if (aHasOrder && bHasOrder) return a.customSortOrder - b.customSortOrder;
  if (aHasOrder) return 1;
  if (bHasOrder) return -1;

  return compareByCreatedAt(b, a);
};

const compareMissions = (a, b, filters) => {
  let comparison = 0;

  switch (filters.sortBy) {
    case 'custom':
      comparison = compareByCustomOrder(a, b);
      break;

    case 'dueDate':
      comparison = compareByDueDate(a, b);
      break;

    case 'createdAt':
      comparison = compareByCreatedAt(a, b);
      break;

    case 'difficulty': {
      const difficultyOrder = { easy: 1, medium: 2, hard: 3 };
      comparison = (difficultyOrder[a.difficulty] || 2) - (difficultyOrder[b.difficulty] || 2);
      break;
    }

    case 'title':
      comparison = (a.title || '').localeCompare(b.title || '');
      break;

    default:
      comparison = compareByDueDate(a, b);
      break;
  }

  return filters.sortOrder === 'desc' ? -comparison : comparison;
};

export const applyMissionFiltersAndSort = (missionData = [], filters) => {
  const filterSettings = normalizeMissionListFilters(filters);
  let filteredMissions = [...missionData];

  if (filterSettings.skillFilter) {
    if (filterSettings.skillFilter === '__has_skill__') {
      filteredMissions = filteredMissions.filter(mission => !!mission.skill);
    } else {
      filteredMissions = filteredMissions.filter(mission =>
        mission.skill === filterSettings.skillFilter
      );
    }
  }

  if (filterSettings.roomFilter) {
    if (filterSettings.roomFilter === '__has_room__') {
      filteredMissions = filteredMissions.filter(mission => !!mission.baseLocation);
    } else if (filterSettings.roomFilter === '__unassigned__') {
      filteredMissions = filteredMissions.filter(mission => !mission.baseLocation);
    } else {
      filteredMissions = filteredMissions.filter(mission =>
        mission.baseLocation === filterSettings.roomFilter
      );
    }
  }

  if (filterSettings.taskTypeFilter) {
    filteredMissions = filteredMissions.filter(mission =>
      mission.dueType === filterSettings.taskTypeFilter
    );
  }

  if (filterSettings.questFilter) {
    if (filterSettings.questFilter === '__has_quest__') {
      filteredMissions = filteredMissions.filter(mission => !!mission.questId);
    } else if (filterSettings.questFilter === '__none__') {
      filteredMissions = filteredMissions.filter(mission => !mission.questId);
    } else {
      filteredMissions = filteredMissions.filter(mission =>
        mission.questId === filterSettings.questFilter
      );
    }
  }

  if (filterSettings.priorityFilter === '__priority_only__') {
    filteredMissions = filteredMissions.filter(mission => mission.isPriority === true);
  }

  if (filterSettings.includeCompleted && filterSettings.completedDateRange) {
    filteredMissions = filteredMissions.filter(mission => {
      if (mission.status !== 'completed') {
        return true;
      }
      return isWithinCompletedDateRange(mission, filterSettings.completedDateRange);
    });
  }

  const sorted = filteredMissions.sort((a, b) => compareMissions(a, b, filterSettings));

  // When the user has opted to include completed missions, stack them at the
  // top of the list above active ones. Within each partition we keep the
  // user's chosen sort order. This makes "what did I just finish?" obvious
  // without requiring a separate view.
  if (filterSettings.includeCompleted) {
    const completed = sorted.filter(m => m.status === 'completed');
    const active = sorted.filter(m => m.status !== 'completed');
    return [...completed, ...active];
  }

  return sorted;
};

// Group an already-sorted list of missions into date buckets. Used by the
// Mission Bank when sortBy === 'dueDate' to give a contextual sense of
// urgency. Bucket order is fixed (chronological / by urgency); within each
// bucket, missions stay in whatever order the caller passed (so the existing
// sortOrder ASC/DESC is preserved per-bucket). Returns only non-empty buckets.
export const groupMissionsByDueDate = (missions) => {
  const todayDate = new Date();
  const todayMs = todayDate.getTime();
  const todayStr = toIsoDateString(todayDate);
  const tomorrowStr = toIsoDateString(new Date(todayMs + 86400000));
  const weekOutStr = toIsoDateString(new Date(todayMs + 7 * 86400000));

  const buckets = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    later: [],
    noDueDate: [],
  };

  for (const mission of missions) {
    const due = mission.dueDate;
    if (!due || due === '') {
      buckets.noDueDate.push(mission);
    } else if (due < todayStr) {
      buckets.overdue.push(mission);
    } else if (due === todayStr) {
      buckets.today.push(mission);
    } else if (due === tomorrowStr) {
      buckets.tomorrow.push(mission);
    } else if (due <= weekOutStr) {
      buckets.thisWeek.push(mission);
    } else {
      buckets.later.push(mission);
    }
  }

  const order = [
    ['overdue', 'Overdue'],
    ['today', 'Today'],
    ['tomorrow', 'Tomorrow'],
    ['thisWeek', 'This Week'],
    ['later', 'Later'],
    ['noDueDate', 'No due date'],
  ];

  return order
    .filter(([key]) => buckets[key].length > 0)
    .map(([key, label]) => ({ key, label, missions: buckets[key] }));
};

const toIsoDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getMissionListDisplayMissions = ({
  missions = [],
  missionType,
  recentlyCompletedMissions = [],
  searchQuery = '',
  roomsMap = {},
  questsMap = {}
}) => {
  const recentlyCompletedIds = recentlyCompletedMissions.map(mission => mission.id);
  const filteredMissions = missions.filter(mission => !recentlyCompletedIds.includes(mission.id));
  const trimmedQuery = (searchQuery || '').trim().toLowerCase();

  // Search matches across the fields the user is most likely to remember:
  // title, description, skill name, room name (resolved via roomsMap), and
  // quest title (resolved via questsMap). Each is short-circuit checked.
  const matchesSearch = (mission) => {
    if (!trimmedQuery) return true;
    if (mission.title?.toLowerCase().includes(trimmedQuery)) return true;
    if (mission.description?.toLowerCase().includes(trimmedQuery)) return true;
    if (mission.skill?.toLowerCase().includes(trimmedQuery)) return true;
    const roomName = mission.baseLocation ? roomsMap[mission.baseLocation]?.name : null;
    if (roomName?.toLowerCase().includes(trimmedQuery)) return true;
    const questTitle = mission.questId ? questsMap[mission.questId]?.title : null;
    if (questTitle?.toLowerCase().includes(trimmedQuery)) return true;
    return false;
  };

  if (missionType === 'active') {
    return [...recentlyCompletedMissions, ...filteredMissions].filter(matchesSearch);
  }

  return missions.filter(matchesSearch);
};
