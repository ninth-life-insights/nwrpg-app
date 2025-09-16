// src/types/__tests__/Mission.dueDates.test.js

import {
  isMissionOverdue,
  isMissionDueToday,
  isMissionDueTomorrow,
  getDaysUntilDue,
  isMissionExpired,
  MISSION_STATUS
} from '../Mission';

describe('Mission Due Date Functions', () => {
  // Helper function to create a mock Firestore timestamp
  const createFirestoreTimestamp = (date) => ({
    toDate: () => new Date(date)
  });

  // Helper function to create mission with specific due date
  const createMissionWithDueDate = (dueDate, status = MISSION_STATUS.ACTIVE, expiryDate = null) => ({
    id: 'test-mission',
    title: 'Test Mission',
    status,
    dueDate: dueDate ? createFirestoreTimestamp(dueDate) : null,
    expiryDate: expiryDate ? createFirestoreTimestamp(expiryDate) : null
  });

  // Set up consistent date for testing
  const mockToday = new Date('2025-09-15T10:30:00.000Z'); // Monday, September 15, 2025
  const originalDate = Date;

  beforeAll(() => {
    // Mock Date constructor to return consistent date
    global.Date = class extends Date {
      constructor(...args) {
        if (args.length === 0) {
          return mockToday;
        }
        return new originalDate(...args);
      }
      
      static now() {
        return mockToday.getTime();
      }
    };
  });

  afterAll(() => {
    // Restore original Date
    global.Date = originalDate;
  });

  describe('isMissionOverdue', () => {
    test('returns false for mission with no due date', () => {
      const mission = createMissionWithDueDate(null);
      expect(isMissionOverdue(mission)).toBe(false);
    });

    test('returns false for completed mission even if past due date', () => {
      const pastDate = '2025-09-14T23:59:59.999Z'; // Yesterday
      const mission = createMissionWithDueDate(pastDate, MISSION_STATUS.COMPLETED);
      expect(isMissionOverdue(mission)).toBe(false);
    });

    test('returns true for active mission past due date', () => {
      const pastDate = '2025-09-14T23:59:59.999Z'; // Yesterday
      const mission = createMissionWithDueDate(pastDate);
      expect(isMissionOverdue(mission)).toBe(true);
    });

    test('returns false for mission due today', () => {
      const todayDate = '2025-09-15T15:30:00.000Z'; // Today but later time
      const mission = createMissionWithDueDate(todayDate);
      expect(isMissionOverdue(mission)).toBe(false);
    });

    test('returns false for mission due tomorrow', () => {
      const tomorrowDate = '2025-09-16T08:00:00.000Z'; // Tomorrow
      const mission = createMissionWithDueDate(tomorrowDate);
      expect(isMissionOverdue(mission)).toBe(false);
    });

    test('handles edge case of due date at end of day', () => {
      const endOfYesterday = '2025-09-14T23:59:59.999Z';
      const mission = createMissionWithDueDate(endOfYesterday);
      expect(isMissionOverdue(mission)).toBe(true);
    });

    test('handles regular Date objects (not Firestore timestamps)', () => {
      const pastDate = '2025-09-14T12:00:00.000Z';
      const mission = {
        ...createMissionWithDueDate(null),
        dueDate: new Date(pastDate)
      };
      expect(isMissionOverdue(mission)).toBe(true);
    });
  });

  describe('isMissionDueToday', () => {
    test('returns false for mission with no due date', () => {
      const mission = createMissionWithDueDate(null);
      expect(isMissionDueToday(mission)).toBe(false);
    });

    test('returns false for completed mission even if due today', () => {
      const todayDate = '2025-09-15T12:00:00.000Z';
      const mission = createMissionWithDueDate(todayDate, MISSION_STATUS.COMPLETED);
      expect(isMissionDueToday(mission)).toBe(false);
    });

    test('returns true for mission due today (same date)', () => {
      const todayDate = '2025-09-15T15:30:00.000Z'; // Different time but same date
      const mission = createMissionWithDueDate(todayDate);
      expect(isMissionDueToday(mission)).toBe(true);
    });

    test('returns false for mission due yesterday', () => {
      const yesterdayDate = '2025-09-14T12:00:00.000Z';
      const mission = createMissionWithDueDate(yesterdayDate);
      expect(isMissionDueToday(mission)).toBe(false);
    });

    test('returns false for mission due tomorrow', () => {
      const tomorrowDate = '2025-09-16T08:00:00.000Z';
      const mission = createMissionWithDueDate(tomorrowDate);
      expect(isMissionDueToday(mission)).toBe(false);
    });

    test('handles different times on same day', () => {
      const earlyMorning = '2025-09-15T00:00:00.000Z';
      const lateNight = '2025-09-15T23:59:59.999Z';
      
      const missionEarly = createMissionWithDueDate(earlyMorning);
      const missionLate = createMissionWithDueDate(lateNight);
      
      expect(isMissionDueToday(missionEarly)).toBe(true);
      expect(isMissionDueToday(missionLate)).toBe(true);
    });

    test('handles regular Date objects', () => {
      const todayDate = '2025-09-15T18:00:00.000Z';
      const mission = {
        ...createMissionWithDueDate(null),
        dueDate: new Date(todayDate)
      };
      expect(isMissionDueToday(mission)).toBe(true);
    });
  });

  describe('isMissionDueTomorrow', () => {
    test('returns false for mission with no due date', () => {
      const mission = createMissionWithDueDate(null);
      expect(isMissionDueTomorrow(mission)).toBe(false);
    });

    test('returns false for completed mission even if due tomorrow', () => {
      const tomorrowDate = '2025-09-16T12:00:00.000Z';
      const mission = createMissionWithDueDate(tomorrowDate, MISSION_STATUS.COMPLETED);
      expect(isMissionDueTomorrow(mission)).toBe(false);
    });

    test('returns true for mission due tomorrow', () => {
      const tomorrowDate = '2025-09-16T15:30:00.000Z';
      const mission = createMissionWithDueDate(tomorrowDate);
      expect(isMissionDueTomorrow(mission)).toBe(true);
    });

    test('returns false for mission due today', () => {
      const todayDate = '2025-09-15T12:00:00.000Z';
      const mission = createMissionWithDueDate(todayDate);
      expect(isMissionDueTomorrow(mission)).toBe(false);
    });

    test('returns false for mission due day after tomorrow', () => {
      const dayAfterTomorrowDate = '2025-09-17T08:00:00.000Z';
      const mission = createMissionWithDueDate(dayAfterTomorrowDate);
      expect(isMissionDueTomorrow(mission)).toBe(false);
    });

    test('handles different times on tomorrow', () => {
      const earlyTomorrow = '2025-09-16T00:00:00.000Z';
      const lateTomorrow = '2025-09-16T23:59:59.999Z';
      
      const missionEarly = createMissionWithDueDate(earlyTomorrow);
      const missionLate = createMissionWithDueDate(lateTomorrow);
      
      expect(isMissionDueTomorrow(missionEarly)).toBe(true);
      expect(isMissionDueTomorrow(missionLate)).toBe(true);
    });

    test('handles regular Date objects', () => {
      const tomorrowDate = '2025-09-16T14:00:00.000Z';
      const mission = {
        ...createMissionWithDueDate(null),
        dueDate: new Date(tomorrowDate)
      };
      expect(isMissionDueTomorrow(mission)).toBe(true);
    });
  });

  describe('getDaysUntilDue', () => {
    test('returns null for mission with no due date', () => {
      const mission = createMissionWithDueDate(null);
      expect(getDaysUntilDue(mission)).toBeNull();
    });

    test('returns 0 for mission due today', () => {
      const todayDate = '2025-09-15T18:00:00.000Z';
      const mission = createMissionWithDueDate(todayDate);
      expect(getDaysUntilDue(mission)).toBe(0);
    });

    test('returns 1 for mission due tomorrow', () => {
      const tomorrowDate = '2025-09-16T08:00:00.000Z';
      const mission = createMissionWithDueDate(tomorrowDate);
      expect(getDaysUntilDue(mission)).toBe(1);
    });

    test('returns -1 for mission due yesterday', () => {
      const yesterdayDate = '2025-09-14T12:00:00.000Z';
      const mission = createMissionWithDueDate(yesterdayDate);
      expect(getDaysUntilDue(mission)).toBe(-1);
    });

    test('returns correct days for mission due in a week', () => {
      const nextWeekDate = '2025-09-22T10:00:00.000Z'; // 7 days from now
      const mission = createMissionWithDueDate(nextWeekDate);
      expect(getDaysUntilDue(mission)).toBe(7);
    });

    test('returns correct negative days for mission overdue by a week', () => {
      const lastWeekDate = '2025-09-08T10:00:00.000Z'; // 7 days ago
      const mission = createMissionWithDueDate(lastWeekDate);
      expect(getDaysUntilDue(mission)).toBe(-7);
    });

    test('handles edge cases around midnight', () => {
      const justAfterMidnightToday = '2025-09-15T00:00:01.000Z';
      const justBeforeMidnightTomorrow = '2025-09-16T23:59:59.999Z';
      
      const missionToday = createMissionWithDueDate(justAfterMidnightToday);
      const missionTomorrow = createMissionWithDueDate(justBeforeMidnightTomorrow);
      
      expect(getDaysUntilDue(missionToday)).toBe(0);
      expect(getDaysUntilDue(missionTomorrow)).toBe(1);
    });

    test('handles regular Date objects', () => {
      const futureDate = '2025-09-20T15:00:00.000Z'; // 5 days from now
      const mission = {
        ...createMissionWithDueDate(null),
        dueDate: new Date(futureDate)
      };
      expect(getDaysUntilDue(mission)).toBe(5);
    });
  });

  describe('isMissionExpired', () => {
    test('returns false for mission with no expiry date', () => {
      const mission = createMissionWithDueDate(null, MISSION_STATUS.ACTIVE, null);
      expect(isMissionExpired(mission)).toBe(false);
    });

    test('returns true for mission past expiry date', () => {
      const pastExpiryDate = '2025-09-14T23:59:59.999Z'; // Yesterday
      const mission = createMissionWithDueDate(null, MISSION_STATUS.ACTIVE, pastExpiryDate);
      expect(isMissionExpired(mission)).toBe(true);
    });

    test('returns false for mission not yet expired', () => {
      const futureExpiryDate = '2025-09-16T00:00:00.000Z'; // Tomorrow
      const mission = createMissionWithDueDate(null, MISSION_STATUS.ACTIVE, futureExpiryDate);
      expect(isMissionExpired(mission)).toBe(false);
    });

    test('returns false for mission expiring exactly now', () => {
      const nowExpiryDate = '2025-09-15T10:30:00.000Z'; // Exactly current time
      const mission = createMissionWithDueDate(null, MISSION_STATUS.ACTIVE, nowExpiryDate);
      expect(isMissionExpired(mission)).toBe(false);
    });

    test('returns true for mission expired by 1 second', () => {
      const justExpiredDate = '2025-09-15T10:29:59.999Z'; // 1 second ago
      const mission = createMissionWithDueDate(null, MISSION_STATUS.ACTIVE, justExpiredDate);
      expect(isMissionExpired(mission)).toBe(true);
    });

    test('handles regular Date objects for expiry', () => {
      const pastExpiryDate = '2025-09-10T12:00:00.000Z';
      const mission = {
        ...createMissionWithDueDate(null),
        expiryDate: new Date(pastExpiryDate)
      };
      expect(isMissionExpired(mission)).toBe(true);
    });

    test('works independently of mission status', () => {
      const pastExpiryDate = '2025-09-14T12:00:00.000Z';
      
      const activeMission = createMissionWithDueDate(null, MISSION_STATUS.ACTIVE, pastExpiryDate);
      const completedMission = createMissionWithDueDate(null, MISSION_STATUS.COMPLETED, pastExpiryDate);
      const expiredMission = createMissionWithDueDate(null, MISSION_STATUS.EXPIRED, pastExpiryDate);
      
      expect(isMissionExpired(activeMission)).toBe(true);
      expect(isMissionExpired(completedMission)).toBe(true);
      expect(isMissionExpired(expiredMission)).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    test('mission due today but expired yesterday', () => {
      const todayDue = '2025-09-15T12:00:00.000Z';
      const yesterdayExpiry = '2025-09-14T23:59:59.999Z';
      
      const mission = {
        ...createMissionWithDueDate(todayDue),
        expiryDate: createFirestoreTimestamp(yesterdayExpiry)
      };
      
      expect(isMissionDueToday(mission)).toBe(true);
      expect(isMissionExpired(mission)).toBe(true);
      expect(isMissionOverdue(mission)).toBe(false);
    });

    test('mission overdue but not yet expired', () => {
      const yesterdayDue = '2025-09-14T12:00:00.000Z';
      const tomorrowExpiry = '2025-09-16T23:59:59.999Z';
      
      const mission = {
        ...createMissionWithDueDate(yesterdayDue),
        expiryDate: createFirestoreTimestamp(tomorrowExpiry)
      };
      
      expect(isMissionOverdue(mission)).toBe(true);
      expect(isMissionExpired(mission)).toBe(false);
      expect(getDaysUntilDue(mission)).toBe(-1);
    });

    test('mission due in future with various expiry scenarios', () => {
      const nextWeekDue = '2025-09-22T12:00:00.000Z';
      
      // Case 1: Expires before due date
      const expiryBeforeDue = '2025-09-20T12:00:00.000Z';
      const missionEarlyExpiry = {
        ...createMissionWithDueDate(nextWeekDue),
        expiryDate: createFirestoreTimestamp(expiryBeforeDue)
      };
      
      expect(getDaysUntilDue(missionEarlyExpiry)).toBe(7);
      expect(isMissionExpired(missionEarlyExpiry)).toBe(false);
      
      // Case 2: Expires after due date
      const expiryAfterDue = '2025-09-25T12:00:00.000Z';
      const missionLateExpiry = {
        ...createMissionWithDueDate(nextWeekDue),
        expiryDate: createFirestoreTimestamp(expiryAfterDue)
      };
      
      expect(getDaysUntilDue(missionLateExpiry)).toBe(7);
      expect(isMissionExpired(missionLateExpiry)).toBe(false);
    });
  });

  describe('Edge cases and error handling', () => {
    test('handles invalid date strings gracefully', () => {
      const mission = {
        ...createMissionWithDueDate(null),
        dueDate: { toDate: () => new Date('invalid-date') }
      };
      
      // The function should handle invalid dates without throwing
      expect(() => isMissionOverdue(mission)).not.toThrow();
      expect(() => isMissionDueToday(mission)).not.toThrow();
      expect(() => getDaysUntilDue(mission)).not.toThrow();
    });

    test('handles missions without toDate method', () => {
      const mission = {
        ...createMissionWithDueDate(null),
        dueDate: '2025-09-15T12:00:00.000Z' // Plain string
      };
      
      expect(isMissionDueToday(mission)).toBe(true);
    });

    test('handles timezone differences correctly', () => {
      // Test with different timezone but same date
      const utcDate = '2025-09-15T23:00:00.000Z'; // 11 PM UTC
      const mission = createMissionWithDueDate(utcDate);
      
      expect(isMissionDueToday(mission)).toBe(true);
    });

    test('handles leap year edge cases', () => {
      // Mock a leap year date for comprehensive testing
      const leapYearMockDate = new Date('2024-02-29T10:30:00.000Z');
      
      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            return leapYearMockDate;
          }
          return new originalDate(...args);
        }
      };
      
      const nextDayDate = '2024-03-01T12:00:00.000Z';
      const mission = createMissionWithDueDate(nextDayDate);
      
      expect(getDaysUntilDue(mission)).toBe(1);
      
      // Restore the original mock
      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            return mockToday;
          }
          return new originalDate(...args);
        }
      };
    });
  });
});