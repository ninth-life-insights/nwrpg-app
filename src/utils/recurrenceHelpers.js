// src/utils/recurrenceHelpers.js
import { RECURRENCE_PATTERNS } from '../components/missions/sub-components/recurrenceSelector';
import dayjs from 'dayjs';

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

// Calculate the next due date based on recurrence pattern
export const calculateNextDueDate = (currentDueDate, recurrence) => {
  if (!recurrence || !recurrence.isRecurring) {
    return null;
  }

  const current = dayjs(currentDueDate);
  const { pattern, interval, weekdays, dayOfMonth } = recurrence;

  switch (pattern) {
    case RECURRENCE_PATTERNS.DAILY:
      return current.add(interval, 'day').format('YYYY-MM-DD');

    case RECURRENCE_PATTERNS.WEEKLY:
      if (weekdays && weekdays.length > 0) {
        // Find the next occurrence of any selected weekday
        let nextDate = current.add(1, 'day');
        let daysChecked = 0;
        
        // Look for the next occurrence within the next 7 days
        while (daysChecked < 7 && !weekdays.includes(nextDate.day())) {
          nextDate = nextDate.add(1, 'day');
          daysChecked++;
        }
        
        // If we found a day in this week, use it. Otherwise, go to next interval
        if (weekdays.includes(nextDate.day())) {
          return nextDate.format('YYYY-MM-DD');
        }
      }
      // Fallback to simple weekly interval
      return current.add(interval, 'week').format('YYYY-MM-DD');

    case RECURRENCE_PATTERNS.MONTHLY:
      let nextMonth = current.add(interval, 'month');
      
      if (dayOfMonth) {
        // Use specific day of month
        const targetDay = Math.min(dayOfMonth, nextMonth.daysInMonth());
        nextMonth = nextMonth.date(targetDay);
      }
      // If no dayOfMonth specified, keep the same day as original due date
      
      return nextMonth.format('YYYY-MM-DD');

    case RECURRENCE_PATTERNS.YEARLY:
      return current.add(interval, 'year').format('YYYY-MM-DD');

    default:
      return null;
  }
};

// Check if recurrence should continue based on end conditions
export const shouldCreateNextOccurrence = (recurrence, currentOccurrenceCount = 0) => {
  if (!recurrence || !recurrence.isRecurring) {
    return false;
  }

  // Check end date
  if (recurrence.endDate) {
    const endDate = dayjs(recurrence.endDate);
    const nextDueDate = dayjs(calculateNextDueDate(dayjs(), recurrence));
    
    if (nextDueDate.isAfter(endDate)) {
      return false;
    }
  }

  // Check max occurrences
  if (recurrence.maxOccurrences) {
    if (currentOccurrenceCount >= recurrence.maxOccurrences) {
      return false;
    }
  }

  return true;
};

// Create next mission instance data
export const createNextMissionInstance = (originalMission, nextDueDate) => {
  // Remove fields that shouldn't be copied to the new instance
  const {
    id,
    status,
    completedAt,
    uncompletedAt,
    expiredAt,
    createdAt,
    updatedAt,
    currentCount, // Reset progress for count-based missions
    actualTimeSpentMinutes, // Reset timer progress
    ...missionData
  } = originalMission;

  return {
    ...missionData,
    dueDate: nextDueDate,
    status: 'active',
    currentCount: 0, // Reset count progress
    actualTimeSpentMinutes: null, // Reset timer progress
    // Keep the original recurrence settings
    recurrence: originalMission.recurrence,
    // Track relationship to original
    parentMissionId: originalMission.parentMissionId || originalMission.id,
    occurrenceNumber: (originalMission.occurrenceNumber || 0) + 1
  };
};

