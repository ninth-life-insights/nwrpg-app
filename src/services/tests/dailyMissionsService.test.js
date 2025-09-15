// src/services/__tests__/dailyMissionService.test.js

import {
  setDailyMissions,
  getDailyMissionsConfig,
  clearDailyMissionStatus,
  resetDailyMissions,
  checkDailyMissionReset
} from '../missionService';

// Mock Firebase Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => 'mock-timestamp')
}));

// Mock the Firebase config
jest.mock('../firebase/config', () => ({
  db: 'mock-db'
}));

import { setDoc, updateDoc, getDoc, getDocs, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';

describe('Daily Missions Service', () => {
  const mockUserId = 'test-user-123';
  const mockMissionIds = ['mission-1', 'mission-2', 'mission-3'];

  beforeEach(() => {
    jest.clearAllMocks();
    serverTimestamp.mockReturnValue('mock-timestamp');
    
    // Set up default mocks for Firebase functions
    doc.mockReturnValue('mock-ref');
    query.mockReturnValue('mock-query');
    where.mockReturnValue('mock-where');
    orderBy.mockReturnValue('mock-orderBy');
  });

  describe('setDailyMissions', () => {
    test('saves exactly 3 daily missions with correct configuration', async () => {
      // Arrange
      doc.mockReturnValue('mock-config-ref');
      setDoc.mockResolvedValue();
      updateDoc.mockResolvedValue();

      // Act
      const result = await setDailyMissions(mockUserId, mockMissionIds);

      // Assert
      expect(doc).toHaveBeenCalledWith('mock-db', 'users', mockUserId, 'dailyMissions', 'config');
      expect(setDoc).toHaveBeenCalledWith('mock-config-ref', {
        selectedMissionIds: mockMissionIds,
        lastResetDate: 'mock-timestamp',
        createdAt: 'mock-timestamp',
        isActive: true
      });
      expect(result).toEqual({ success: true });
    });

    test('updates each selected mission with daily mission properties', async () => {
      // Arrange
      doc.mockReturnValue('mock-ref');
      setDoc.mockResolvedValue();
      updateDoc.mockResolvedValue();

      // Act
      await setDailyMissions(mockUserId, mockMissionIds);

      // Assert
      expect(updateDoc).toHaveBeenCalledTimes(3);
      mockMissionIds.forEach((missionId) => {
        expect(updateDoc).toHaveBeenCalledWith(
          'mock-ref',
          expect.objectContaining({
            isDailyMission: true,
            dailyMissionSetAt: 'mock-timestamp',
            expiryDate: expect.any(Date)
          })
        );
      });
    });

    test('handles Firebase errors gracefully', async () => {
      // Arrange
      doc.mockReturnValue('mock-ref');
      setDoc.mockRejectedValue(new Error('Firebase error'));

      // Act & Assert
      await expect(setDailyMissions(mockUserId, mockMissionIds))
        .rejects
        .toThrow('Firebase error');
    });
  });

  describe('getDailyMissionsConfig', () => {
    test('returns config when it exists', async () => {
      // Arrange
      const mockConfig = {
        selectedMissionIds: mockMissionIds,
        isActive: true,
        lastResetDate: 'mock-timestamp'
      };
      
      doc.mockReturnValue('mock-config-ref');
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConfig
      });

      // Act
      const result = await getDailyMissionsConfig(mockUserId);

      // Assert
      expect(doc).toHaveBeenCalledWith('mock-db', 'users', mockUserId, 'dailyMissions', 'config');
      expect(result).toEqual(mockConfig);
    });

    test('returns null when config does not exist', async () => {
      // Arrange
      doc.mockReturnValue('mock-config-ref');
      getDoc.mockResolvedValue({
        exists: () => false
      });

      // Act
      const result = await getDailyMissionsConfig(mockUserId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('clearDailyMissionStatus', () => {
    test('removes daily mission properties from specified missions', async () => {
      // Arrange
      const missionIdsToClear = ['mission-1', 'mission-2'];
      doc.mockReturnValue('mock-mission-ref');
      updateDoc.mockResolvedValue();

      // Act
      const result = await clearDailyMissionStatus(mockUserId, missionIdsToClear);

      // Assert
      expect(updateDoc).toHaveBeenCalledTimes(2);
      missionIdsToClear.forEach(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          'mock-mission-ref',
          {
            isDailyMission: false,
            dailyMissionSetAt: null,
            expiryDate: null
          }
        );
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('resetDailyMissions', () => {
    test('deactivates daily missions config', async () => {
      // Arrange
      // Mock the getDocs call that getActiveDailyMissions makes
      const mockSnapshot = {
        docs: [] // Return empty array of missions
      };
      
      query.mockReturnValue('mock-query');
      where.mockReturnValue('mock-where');
      orderBy.mockReturnValue('mock-orderBy');
      getDocs.mockResolvedValue(mockSnapshot);
      
      doc.mockReturnValue('mock-config-ref');
      updateDoc.mockResolvedValue();

      // Act
      const result = await resetDailyMissions(mockUserId);

      // Assert
      expect(updateDoc).toHaveBeenCalledWith('mock-config-ref', {
        isActive: false,
        lastResetDate: 'mock-timestamp'
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('checkDailyMissionReset', () => {
    test('detects when reset is needed for new day', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const mockConfig = {
        lastResetDate: {
          toDate: () => yesterday
        },
        isActive: true
      };

      doc.mockReturnValue('mock-config-ref');
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConfig
      });

      // Act
      const result = await checkDailyMissionReset(mockUserId);

      // Assert
      expect(result.needsReset).toBe(true);
      expect(result.config).toEqual(mockConfig);
    });

    test('detects when reset is not needed for same day', async () => {
      // Arrange
      const today = new Date();
      
      const mockConfig = {
        lastResetDate: {
          toDate: () => today
        },
        isActive: true
      };

      doc.mockReturnValue('mock-config-ref');
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockConfig
      });

      // Act
      const result = await checkDailyMissionReset(mockUserId);

      // Assert
      expect(result.needsReset).toBe(false);
    });

    test('returns no reset needed when config does not exist', async () => {
      // Arrange
      doc.mockReturnValue('mock-config-ref');
      getDoc.mockResolvedValue({
        exists: () => false
      });

      // Act
      const result = await checkDailyMissionReset(mockUserId);

      // Assert
      expect(result.needsReset).toBe(false);
    });
  });
});