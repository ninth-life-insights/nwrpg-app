// src/services/tests/dailyMissionReset.simple.test.js
import * as missionService from '../missionService';

// Mock Firebase completely - declare mocks inline
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mock-collection'),
  doc: jest.fn(() => 'mock-doc-ref'),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

// Mock the database config
jest.mock('../firebase/config', () => ({
  db: {}
}));

// Mock dayjs
jest.mock('dayjs', () => jest.fn());

// Mock date helpers
jest.mock('../../utils/dateHelpers', () => ({
  toDateString: jest.fn((date) => '2025-09-20'),
}));

describe('Daily Mission Reset Service', () => {
  const mockUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked functions
    const { getDoc, setDoc, updateDoc, getDocs } = require('firebase/firestore');
    const dayjs = require('dayjs');
    
    // Set up default mock returns
    getDoc.mockResolvedValue({
      exists: () => false,
      data: () => ({})
    });
    
    setDoc.mockResolvedValue();
    updateDoc.mockResolvedValue();
    getDocs.mockResolvedValue({ docs: [] });
    
    // Set up dayjs mock
    dayjs.mockImplementation((date) => ({
      format: jest.fn(() => '2025-09-20'),
      isBefore: jest.fn(() => false),
      isSame: jest.fn(() => false),
      add: jest.fn(() => dayjs()),
      subtract: jest.fn(() => dayjs()),
      toDate: jest.fn(() => new Date()),
    }));
  });

  describe('checkAndHandleDailyMissionReset', () => {
    test('should return false when no reset is needed', async () => {
      const { getDoc } = require('firebase/firestore');
      const dayjs = require('dayjs');
      
      // Mock config exists but no archiving needed
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          selectedMissionIds: ['mission-1'],
          isActive: true,
          lastResetDate: new Date(),
          dateSet: '2025-09-20'
        })
      });

      // Mock that current date is same as last reset (no archiving needed)
      dayjs.mockImplementation(() => ({
        isBefore: jest.fn(() => false), // Not before today
        format: jest.fn(() => '2025-09-20')
      }));

      const result = await missionService.checkAndHandleDailyMissionReset(mockUserId);

      expect(result.wasReset).toBe(false);
    });

    test('should return true when reset occurs and archive missions', async () => {
      const { getDoc, getDocs } = require('firebase/firestore');
      const dayjs = require('dayjs');
      const { toDateString } = require('../../utils/dateHelpers');
      
      // Mock toDateString to return the expected archived date
      toDateString.mockReturnValue('2025-09-19');
      
      // Mock config with old date
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          selectedMissionIds: ['mission-1'],
          isActive: true,
          lastResetDate: new Date('2025-09-19'),
          dateSet: '2025-09-19'
        })
      });

      // Mock active missions
      getDocs.mockResolvedValue({
        docs: [
          {
            id: 'mission-1',
            data: () => ({
              id: 'mission-1',
              title: 'Test Mission',
              status: 'active',
              difficulty: 'medium',
              xpReward: 10
            })
          }
        ]
      });

      // Mock that yesterday is before today (archiving needed)
      dayjs.mockImplementation(() => ({
        isBefore: jest.fn(() => true), // Last reset was before today
        format: jest.fn(() => '2025-09-20')
      }));

      const result = await missionService.checkAndHandleDailyMissionReset(mockUserId);

      expect(result.wasReset).toBe(true);
      expect(result.archivedDate).toBe('2025-09-19');
      expect(result.archivedCount).toBe(1);
    });

    test('should handle errors gracefully', async () => {
      const { getDoc } = require('firebase/firestore');
      
      // Mock getDoc to throw error
      getDoc.mockRejectedValue(new Error('Database error'));

      await expect(missionService.checkAndHandleDailyMissionReset(mockUserId))
        .rejects.toThrow('Database error');
    });
  });

  describe('getDailyMissionsConfig', () => {
    test('should return config when it exists', async () => {
      const mockConfig = {
        selectedMissionIds: ['mission-1', 'mission-2'],
        isActive: true,
        lastResetDate: new Date(),
        dateSet: '2025-09-20'
      };

      // Mock getDoc to return config
      const { getDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConfig
      });

      const result = await missionService.getDailyMissionsConfig(mockUserId);
      expect(result).toEqual(mockConfig);
    });

    test('should return null when config does not exist', async () => {
      const { getDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({
        exists: () => false
      });

      const result = await missionService.getDailyMissionsConfig(mockUserId);
      expect(result).toBeNull();
    });
  });

  describe('setDailyMissions', () => {
    test('should create config and mark missions as daily', async () => {
      const { setDoc, updateDoc } = require('firebase/firestore');
      const selectedMissionIds = ['mission-1', 'mission-2', 'mission-3'];
      
      // Mock toDateString to return expected date
      const { toDateString } = require('../../utils/dateHelpers');
      toDateString.mockReturnValue('2025-09-20');

      const result = await missionService.setDailyMissions(mockUserId, selectedMissionIds);

      expect(result.success).toBe(true);
      expect(setDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({
          selectedMissionIds,
          isActive: true,
          dateSet: '2025-09-20'
        })
      );
      expect(updateDoc).toHaveBeenCalledTimes(3); // Once for each mission
    });
  });

  describe('clearDailyMissionStatus', () => {
    test('should clear daily mission flags from all provided missions', async () => {
      const { updateDoc } = require('firebase/firestore');
      const missionIds = ['mission-1', 'mission-2', 'mission-3'];

      const result = await missionService.clearDailyMissionStatus(mockUserId, missionIds);

      expect(result.success).toBe(true);
      expect(updateDoc).toHaveBeenCalledTimes(3);
      
      // Check that each call clears the daily mission fields
      missionIds.forEach((_, index) => {
        expect(updateDoc).toHaveBeenNthCalledWith(index + 1, 
          'mock-doc-ref',
          expect.objectContaining({
            isDailyMission: false,
            dailyMissionSetAt: null,
            dailyMissionDate: null
          })
        );
      });
    });
  });

  describe('archiveDailyMissionsForDate', () => {
    test('should archive missions data for a specific date', async () => {
      const { setDoc } = require('firebase/firestore');
      const dateString = '2025-09-19';
      const missionsData = [
        { id: 'mission-1', title: 'Test Mission 1', completed: true },
        { id: 'mission-2', title: 'Test Mission 2', completed: false }
      ];

      const result = await missionService.archiveDailyMissionsForDate(mockUserId, dateString, missionsData);

      expect(result.success).toBe(true);
      expect(setDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({
          date: dateString,
          missions: missionsData,
          completedCount: 1,
          totalCount: 2
        })
      );
    });

    test('should handle undefined values in mission data', async () => {
      const { setDoc } = require('firebase/firestore');
      const dateString = '2025-09-19';
      const missionsData = [
        { 
          id: 'mission-1', 
          title: 'Test Mission 1', 
          completed: true,
          xpReward: undefined, // This should be filtered out
          spReward: null
        }
      ];

      await missionService.archiveDailyMissionsForDate(mockUserId, dateString, missionsData);

      // Should still succeed without throwing Firestore errors about undefined values
      expect(setDoc).toHaveBeenCalled();
    });
  });
});

describe('Integration: Daily Mission Lifecycle', () => {
  const mockUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset all mocks
    const { getDoc, setDoc, updateDoc, getDocs } = require('firebase/firestore');
    getDoc.mockResolvedValue({
      exists: () => false,
      data: () => ({})
    });
    setDoc.mockResolvedValue();
    updateDoc.mockResolvedValue();
    getDocs.mockResolvedValue({ docs: [] });
  });

  test('should set daily missions and then be able to clear them', async () => {
    const { setDoc, updateDoc } = require('firebase/firestore');
    const selectedMissionIds = ['mission-1', 'mission-2'];

    // Mock toDateString
    const { toDateString } = require('../../utils/dateHelpers');
    toDateString.mockReturnValue('2025-09-20');

    // 1. Set daily missions
    const setResult = await missionService.setDailyMissions(mockUserId, selectedMissionIds);
    expect(setResult.success).toBe(true);

    // 2. Clear daily mission status
    const clearResult = await missionService.clearDailyMissionStatus(mockUserId, selectedMissionIds);
    expect(clearResult.success).toBe(true);

    // Verify both operations called the right Firebase functions
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc).toHaveBeenCalledTimes(4); // 2 for setting + 2 for clearing
  });
});