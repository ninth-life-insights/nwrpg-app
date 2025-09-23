// src/utils/recurrenceHelpers.js
import { RECURRENCE_PATTERNS } from '../components/missions/sub-components/recurrenceSelector';

// Check if mission is recurring
export const isRecurringMission = (mission) => {
  return mission.recurrence && mission.recurrence.isRecurring;
};

// Get display text for recurrence pattern
export const getRecurrenceDisplayText = (mission) => {
  if (!isRecurringMission(mission)) return null;
  
  const { pattern, interval } = mission.recurrence;
  
  switch (pattern) {
    case RECURRENCE_PATTERNS.DAILY:
      return interval === 1 ? 'Daily' : `Every ${interval} days`;
    
    case RECURRENCE_PATTERNS.WEEKLY:
      return interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
    
    case RECURRENCE_PATTERNS.MONTHLY:
      return interval === 1 ? 'Monthly' : `Every ${interval} months`;
    
    case RECURRENCE_PATTERNS.YEARLY:
      return interval === 1 ? 'Yearly' : `Every ${interval} years`;
    
    default:
      return 'Recurring';
  }
};