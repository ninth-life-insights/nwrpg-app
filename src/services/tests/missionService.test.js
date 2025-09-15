// src/services/__tests__/missionService.test.js

import { 
  createMission, 
  completeMission, 
  uncompleteMission, 
  updateMission 
} from '../missionService';

// Mock Firebase Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => 'mock-timestamp')
}));

// Mock the Firebase config - path is relative to the test file location
jest.mock('../firebase/config', () => ({
  db: 'mock-db'
}));

// Import mocked functions for assertions
import { addDoc, updateDoc, collection, doc, serverTimestamp } from 'firebase/firestore';

describe('Mission Service', () => {
  const mockUserId = 'test-user-123';
  const mockMissionId = 'mission-456';

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Make sure serverTimestamp returns our mock value
    serverTimestamp.mockReturnValue('mock-timestamp');
  });

  describe('createMission', () => {
    test('creates a mission with required fields', async () => {
      // Arrange
      const missionData = {
        title: 'Do laundry',
        description: 'Wash and fold clothes',
        difficulty: 'easy',
        xpReward: 10
      };

      // Mock the Firebase functions
      collection.mockReturnValue('mock-collection-ref');
      addDoc.mockResolvedValue({ id: 'new-mission-id' });

      // Act
      const result = await createMission(mockUserId, missionData);

      // Assert
      expect(collection).toHaveBeenCalledWith('mock-db', 'users', mockUserId, 'missions');
      expect(addDoc).toHaveBeenCalledWith(
        'mock-collection-ref',
        expect.objectContaining({
          title: 'Do laundry',
          description: 'Wash and fold clothes',
          difficulty: 'easy',
          xpReward: 10,
          status: 'active',
          createdAt: 'mock-timestamp',
          completedAt: null
        })
      );
      expect(result).toBe('new-mission-id');
    });

    test('handles Firebase errors gracefully', async () => {
      // Arrange
      const missionData = { title: 'Test mission' };
      collection.mockReturnValue('mock-collection-ref');
      addDoc.mockRejectedValue(new Error('Firebase error'));

      // Act & Assert
      await expect(createMission(mockUserId, missionData))
        .rejects
        .toThrow('Firebase error');
    });
  });

  describe('completeMission', () => {
    test('marks mission as completed with timestamp', async () => {
      // Arrange
      doc.mockReturnValue('mock-doc-ref');
      updateDoc.mockResolvedValue();

      // Act
      await completeMission(mockUserId, mockMissionId);

      // Assert
      expect(doc).toHaveBeenCalledWith('mock-db', 'users', mockUserId, 'missions', mockMissionId);
      expect(updateDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        {
          status: 'completed',
          completedAt: 'mock-timestamp'
        }
      );
    });

    test('handles Firebase errors gracefully', async () => {
      // Arrange
      doc.mockReturnValue('mock-doc-ref');
      updateDoc.mockRejectedValue(new Error('Firebase error'));

      // Act & Assert
      await expect(completeMission(mockUserId, mockMissionId))
        .rejects
        .toThrow('Firebase error');
    });
  });

  describe('uncompleteMission', () => {
    test('reverts mission to active status', async () => {
      // Arrange
      doc.mockReturnValue('mock-doc-ref');
      updateDoc.mockResolvedValue();

      // Act
      await uncompleteMission(mockUserId, mockMissionId);

      // Assert
      expect(doc).toHaveBeenCalledWith('mock-db', 'users', mockUserId, 'missions', mockMissionId);
      expect(updateDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        {
          status: 'active',
          completedAt: null,
          uncompletedAt: 'mock-timestamp'
        }
      );
    });
  });

  describe('updateMission', () => {
    test('updates mission with new data and timestamp', async () => {
      // Arrange
      const updates = {
        title: 'Updated title',
        description: 'Updated description'
      };
      doc.mockReturnValue('mock-doc-ref');
      updateDoc.mockResolvedValue();

      // Act
      await updateMission(mockUserId, mockMissionId, updates);

      // Assert
      expect(doc).toHaveBeenCalledWith('mock-db', 'users', mockUserId, 'missions', mockMissionId);
      expect(updateDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        {
          title: 'Updated title',
          description: 'Updated description',
          updatedAt: 'mock-timestamp'
        }
      );
    });
  });
});