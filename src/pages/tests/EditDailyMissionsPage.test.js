// src/pages/__tests__/EditDailyMissionsPage.test.js

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditDailyMissionsPage from '../EditDailyMissionsPage';

// Mock the auth context
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'test-user-123' }
  })
}));

// Mock the mission services
jest.mock('../../services/missionService', () => ({
  getActiveMissions: jest.fn(),
  getDailyMissionsConfig: jest.fn(),
  setDailyMissions: jest.fn(),
  clearDailyMissionStatus: jest.fn()
}));

// Mock child components
jest.mock('../../components/missions/AddMissionCard', () => {
  return function MockAddMissionCard({ onAddMission, onCancel }) {
    return (
      <div data-testid="add-mission-card">
        <button 
          onClick={() => onAddMission({ 
            id: 'new-mission', 
            title: 'New Mission',
            description: 'Test mission' 
          })}
        >
          Add Mission
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  };
});

jest.mock('../../components/missions/MissionList', () => {
  return function MockMissionList({ onMissionSelect, selectionMode }) {
    const mockMissions = [
      { id: 'existing-1', title: 'Existing Mission 1' },
      { id: 'existing-2', title: 'Existing Mission 2' }
    ];

    if (!selectionMode) return <div data-testid="mission-list">Mission List</div>;

    return (
      <div data-testid="mission-bank">
        {mockMissions.map(mission => (
          <button 
            key={mission.id}
            onClick={() => onMissionSelect(mission)}
          >
            {mission.title}
          </button>
        ))}
      </div>
    );
  };
});

import {
  getActiveMissions,
  getDailyMissionsConfig,
  setDailyMissions,
  clearDailyMissionStatus
} from '../../services/missionService';

describe('EditDailyMissionsPage', () => {
  const mockExistingDailyMissions = [
    { id: 'daily-1', title: 'Morning Exercise', isDailyMission: true },
    { id: 'daily-2', title: 'Read Book', isDailyMission: true },
    { id: 'daily-3', title: 'Plan Tomorrow', isDailyMission: true }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    getActiveMissions.mockResolvedValue([]);
    getDailyMissionsConfig.mockResolvedValue(null);
    setDailyMissions.mockResolvedValue({ success: true });
    clearDailyMissionStatus.mockResolvedValue({ success: true });
  });

  test('renders empty slots when no daily missions are configured', async () => {
    // Act
    render(<EditDailyMissionsPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading daily missions...')).not.toBeInTheDocument();
    });

    // Assert
    expect(screen.getByRole('heading', { name: 'Set Daily Missions' })).toBeInTheDocument();

    // Should show 3 empty slots - use more specific selector
    const slotNumbers = screen.getAllByText(/^[123]$/); // Only match single digits 1, 2, 3
    expect(slotNumbers).toHaveLength(3);
  });

  test('loads existing daily missions configuration', async () => {
    // Arrange
    const mockConfig = {
      selectedMissionIds: ['daily-1', 'daily-2', 'daily-3'],
      isActive: true
    };
    
    getDailyMissionsConfig.mockResolvedValue(mockConfig);
    getActiveMissions.mockResolvedValue(mockExistingDailyMissions);

    // Act
    render(<EditDailyMissionsPage />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
      expect(screen.getByText('Read Book')).toBeInTheDocument();
      expect(screen.getByText('Plan Tomorrow')).toBeInTheDocument();
    });

    expect(getDailyMissionsConfig).toHaveBeenCalledWith('test-user-123');
  });

  test('shows current status when daily missions are already active', async () => {
    // Arrange
    const mockConfig = {
      selectedMissionIds: ['daily-1'],
      isActive: true
    };
    
    getDailyMissionsConfig.mockResolvedValue(mockConfig);
    getActiveMissions.mockResolvedValue([mockExistingDailyMissions[0]]);

    // Act
    render(<EditDailyMissionsPage />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('✅ Daily missions are currently active. You can update them below.')).toBeInTheDocument();
    });
  });

  test('allows adding new mission to empty slot', async () => {
    // Act
    render(<EditDailyMissionsPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading daily missions...')).not.toBeInTheDocument();
    });

    // Click add new mission button
    const addButton = screen.getByText('+ Add New Mission');
    fireEvent.click(addButton);

    // Should show add mission modal
    await waitFor(() => {
      expect(screen.getByTestId('add-mission-card')).toBeInTheDocument();
    });

    // Add a mission
    const addMissionButton = screen.getByText('Add Mission');
    fireEvent.click(addMissionButton);

    // Assert mission is added to slot
    await waitFor(() => {
      expect(screen.getByText('New Mission')).toBeInTheDocument();
    });
  });

  test('allows choosing mission from bank', async () => {
    // Act
    render(<EditDailyMissionsPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading daily missions...')).not.toBeInTheDocument();
    });

    // Click choose from bank button
    const bankButton = screen.getByText('📋 Choose from Mission Bank');
    fireEvent.click(bankButton);

    // Should show mission bank modal
    await waitFor(() => {
      expect(screen.getByTestId('mission-bank')).toBeInTheDocument();
    });

    // Select a mission from bank
    const existingMission = screen.getByText('Existing Mission 1');
    fireEvent.click(existingMission);

    // Assert mission is added to slot
    await waitFor(() => {
      expect(screen.getByText('Existing Mission 1')).toBeInTheDocument();
    });
  });

  test('allows removing mission from slot', async () => {
    // Arrange - start with one mission in slot
    const mockConfig = {
      selectedMissionIds: ['daily-1'],
      isActive: true
    };
    
    getDailyMissionsConfig.mockResolvedValue(mockConfig);
    getActiveMissions.mockResolvedValue([mockExistingDailyMissions[0]]);

    // Act
    render(<EditDailyMissionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    // Click remove button
    const removeButton = screen.getByTitle('Remove mission');
    fireEvent.click(removeButton);

    // Assert mission is removed
    expect(screen.queryByText('Morning Exercise')).not.toBeInTheDocument();
  });

  test('enables set button only when all 3 slots are filled', async () => {
    // Act
    render(<EditDailyMissionsPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading daily missions...')).not.toBeInTheDocument();
    });

    // Initially disabled
    const setButton = screen.getByRole('button', { name: 'Set Daily Missions' });
    expect(setButton).toBeDisabled();
    expect(setButton).toHaveClass('disabled');

    // Add 3 missions
    for (let i = 0; i < 3; i++) {
      const addButton = screen.getByText('+ Add New Mission');
      fireEvent.click(addButton);
      
      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByTestId('add-mission-card')).toBeInTheDocument();
      });
      
      const addMissionButton = screen.getByText('Add Mission');
      fireEvent.click(addMissionButton);
      
      // Wait for mission to be added and modal to disappear
      await waitFor(() => {
        expect(screen.queryByTestId('add-mission-card')).not.toBeInTheDocument();
      });
      
      // Wait for the mission to actually appear in the slot
      await waitFor(() => {
        const missions = screen.getAllByText('New Mission');
        expect(missions).toHaveLength(i + 1);
      });
    }

    // Verify all 3 missions are visible
    const missionTitles = screen.getAllByText('New Mission');
    expect(missionTitles).toHaveLength(3);

    // Check that requirements text is gone (indicates all slots filled)
    expect(screen.queryByText('Fill all 3 slots to set your daily missions')).not.toBeInTheDocument();

    // Should now be enabled
    await waitFor(() => {
      const updatedSetButton = screen.getByRole('button', { name: 'Set Daily Missions' });
      expect(updatedSetButton).not.toBeDisabled();
      expect(updatedSetButton).toHaveClass('enabled');
    });
  });

  test('successfully sets daily missions when all slots are filled', async () => {
    // Arrange - mock successful save
    setDailyMissions.mockResolvedValue({ success: true });
    window.alert = jest.fn(); // Mock alert

    // Add 3 missions first
    render(<EditDailyMissionsPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading daily missions...')).not.toBeInTheDocument();
    });

    // Add 3 missions
    for (let i = 0; i < 3; i++) {
      const addButton = screen.getByText('+ Add New Mission');
      fireEvent.click(addButton);
      
      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByTestId('add-mission-card')).toBeInTheDocument();
      });
      
      const addMissionButton = screen.getByText('Add Mission');
      fireEvent.click(addMissionButton);
      
      // Wait for mission to be added
      await waitFor(() => {
        expect(screen.queryByTestId('add-mission-card')).not.toBeInTheDocument();
      });
    }

    // Click set daily missions
    const setButton = screen.getByRole('button', { name: 'Set Daily Missions' });
    await waitFor(() => {
      expect(setButton).not.toBeDisabled();
    });
    
    fireEvent.click(setButton);

    // Assert
    await waitFor(() => {
      expect(setDailyMissions).toHaveBeenCalledWith(
        'test-user-123',
        ['new-mission', 'new-mission', 'new-mission']
      );
      expect(window.alert).toHaveBeenCalledWith(
        'Daily missions set successfully! Your 3 daily missions are now active.'
      );
    });
  });

  test('shows error when trying to set with less than 3 missions', async () => {
    // Act
    render(<EditDailyMissionsPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading daily missions...')).not.toBeInTheDocument();
    });

    // Add only 1 mission
    const addButton = screen.getByText('+ Add New Mission');
    fireEvent.click(addButton);
    
    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByTestId('add-mission-card')).toBeInTheDocument();
    });
    
    const addMissionButton = screen.getByText('Add Mission');
    fireEvent.click(addMissionButton);

    // Wait for mission to be added
    await waitFor(() => {
      expect(screen.queryByTestId('add-mission-card')).not.toBeInTheDocument();
    });

    // Try to set (this should be prevented by disabled state)
    const setButton = screen.getByRole('button', { name: 'Set Daily Missions' });
    expect(setButton).toBeDisabled();
    
    // Should show requirements text
    expect(screen.getByText('Fill all 3 slots to set your daily missions')).toBeInTheDocument();
  });

  test('disables add buttons when all slots are filled', async () => {
    // Arrange - start with 3 missions
    const mockConfig = {
      selectedMissionIds: ['daily-1', 'daily-2', 'daily-3'],
      isActive: true
    };
    
    getDailyMissionsConfig.mockResolvedValue(mockConfig);
    getActiveMissions.mockResolvedValue(mockExistingDailyMissions);

    // Act
    render(<EditDailyMissionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    // Assert add buttons are disabled
    const addNewButton = screen.getByText('+ Add New Mission');
    const addFromBankButton = screen.getByText('📋 Choose from Mission Bank');
    
    expect(addNewButton).toBeDisabled();
    expect(addFromBankButton).toBeDisabled();
  });
});