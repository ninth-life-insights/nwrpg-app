// src/utils/recurrenceHelpers.js
import { RECURRENCE_PATTERNS } from '../components/missions/sub-components/recurrenceSelector';
import { DUE_TYPES } from '../types/Mission';
import dayjs from 'dayjs';

// Check if mission is recurring
export const isRecurringMission = (mission) => {
  return mission.dueType === DUE_TYPES.RECURRING;
};

// Get display text for recurrence pattern
export const getRecurrenceDisplayText = (mission) => {
  if (!isRecurringMission(mission)) return null;
  
  // Check if recurrence object exists and has pattern
  if (!mission.recurrence || !mission.recurrence.pattern) return 'Recurring';
  
  const { pattern, interval } = mission.recurrence;
  
  switch (pattern) {
    case 'daily':
      return interval === 1 ? 'Daily' : `Every ${interval} days`;
    
    case 'weekly':
      return interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
    
    case 'monthly':
      return interval === 1 ? 'Monthly' : `Every ${interval} months`;
    
    case 'yearly':
      return interval === 1 ? 'Yearly' : `Every ${interval} years`;
    
    default:
      return 'Recurring';
  }
};

// Calculate the next due date based on recurrence pattern
export const calculateNextDueDate = (currentDueDate, recurrence) => {
  if (!recurrence || recurrence.pattern === RECURRENCE_PATTERNS.NONE) {
    return null;
  }

  const current = dayjs(currentDueDate);
  const { pattern, interval, weekdays, dayOfMonth } = recurrence;

  switch (pattern) {
    case RECURRENCE_PATTERNS.DAILY:
    case 'daily': // Support both formats
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
    case 'yearly':
      return current.add(interval, 'year').format('YYYY-MM-DD');

    default:
      return null;
  }
};

// Check if recurrence should continue based on end conditions
export const shouldCreateNextOccurrence = (recurrence, currentOccurrenceCount = 0, currentDueDate) => {
  if (!recurrence || recurrence.pattern === RECURRENCE_PATTERNS.NONE) {
    return false;
  }

  // Check if we've passed the end date
  if (recurrence.endDate) {
    const endDate = dayjs(recurrence.endDate);
    const today = dayjs();
    
    // If today is after the end date, stop creating new instances
    if (today.isAfter(endDate, 'day')) {
      return false;
    }
    
    // Also check if the next calculated due date would be after the end date
    const nextDueDate = dayjs(calculateNextDueDate(currentDueDate, recurrence));
    if (nextDueDate.isAfter(endDate, 'day')) {
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
    occurrenceNumber: (originalMission.occurrenceNumber || 1) + 1
  };
};

