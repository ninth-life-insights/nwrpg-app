// Filter helpers for the suggested-missions catalog. Each surface calls
// the helper that matches its filter axis: room pickers use
// getSuggestionsForRoomIcon; routine builders use
// getSuggestionsForRoutineContext; the general bank uses getGeneralSuggestions.

import { SUGGESTED_MISSIONS } from './suggestedMissions';

/**
 * Returns all suggestions that declare the given room icon as one of their
 * relevant rooms. Used by the room setup flow (RoomPage → picker).
 *
 * @param {string} iconValue - The room's icon (e.g. 'Room-kitchen.png')
 */
export const getSuggestionsForRoomIcon = (iconValue) => {
  if (!iconValue) return [];
  return SUGGESTED_MISSIONS.filter(s =>
    Array.isArray(s.roomIcons) && s.roomIcons.includes(iconValue)
  );
};

/**
 * Returns all suggestions tagged with the given routine context. Used by
 * the routine builder ("Suggested missions for this routine").
 *
 * @param {string} context - One of ROUTINE_CONTEXTS values
 */
export const getSuggestionsForRoutineContext = (context) => {
  if (!context) return [];
  return SUGGESTED_MISSIONS.filter(s =>
    Array.isArray(s.routineContexts) && s.routineContexts.includes(context)
  );
};

/**
 * Returns suggestions matching any of the given tags. Used by general
 * "browse suggestions" surfaces.
 *
 * @param {string[]} tags
 */
export const getSuggestionsByTags = (tags) => {
  if (!Array.isArray(tags) || tags.length === 0) return [];
  return SUGGESTED_MISSIONS.filter(s =>
    Array.isArray(s.tags) && s.tags.some(t => tags.includes(t))
  );
};

/**
 * The full catalog, for surfaces that want to show everything (e.g. a
 * "browse all suggestions" page).
 */
export const getAllSuggestions = () => SUGGESTED_MISSIONS;
