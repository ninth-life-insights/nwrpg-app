// src/components/missions/__tests__/MissionCard.test.js

import { render, screen, fireEvent } from '@testing-library/react';
import MissionCard from '../MissionCard';

// Mock the DifficultyBadge component
jest.mock('../../components/missions/sub-components/DifficultyBadge', () => {
  return function MockDifficultyBadge({ difficulty }) {
    return <span data-testid="difficulty-badge">{difficulty}</span>;
  };
});

describe('MissionCard', () => {
  const mockMission = {
    id: 'mission-1',
    title: 'Do laundry',
    description: 'Wash and fold clothes',
    difficulty: 'easy',
    status: 'active',
    xpReward: 10
  };

  const mockOnToggleComplete = jest.fn();
  const mockOnViewDetails = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders mission information correctly', () => {
    // Act
    render(
      <MissionCard 
        mission={mockMission}
        onToggleComplete={mockOnToggleComplete}
        onViewDetails={mockOnViewDetails}
      />
    );

    // Assert
    expect(screen.getByText('Do laundry')).toBeInTheDocument();
    expect(screen.getByText('Wash and fold clothes')).toBeInTheDocument();
    expect(screen.getByTestId('difficulty-badge')).toHaveTextContent('easy');
  });

  test('shows complete button for active mission', () => {
    // Act
    render(
      <MissionCard 
        mission={mockMission}
        onToggleComplete={mockOnToggleComplete}
        onViewDetails={mockOnViewDetails}
      />
    );

    // Assert
    const button = screen.getByLabelText('Mark as complete');
    expect(button).toBeInTheDocument();
  });

  test('shows incomplete button for completed mission', () => {
    // Arrange
    const completedMission = {
      ...mockMission,
      status: 'completed'
    };

    // Act
    render(
      <MissionCard 
        mission={completedMission}
        onToggleComplete={mockOnToggleComplete}
        onViewDetails={mockOnViewDetails}
      />
    );

    // Assert
    const button = screen.getByLabelText('Mark as incomplete');
    expect(button).toBeInTheDocument();
  });

  test('calls onToggleComplete when button is clicked', () => {
    // Act
    render(
      <MissionCard 
        mission={mockMission}
        onToggleComplete={mockOnToggleComplete}
        onViewDetails={mockOnViewDetails}
      />
    );

    const button = screen.getByLabelText('Mark as complete');
    fireEvent.click(button);

    // Assert - check that it was called with the right arguments
    expect(mockOnToggleComplete).toHaveBeenCalled();
    const callArgs = mockOnToggleComplete.mock.calls[0];
    expect(callArgs[0]).toBe('mission-1');  // mission ID
    expect(callArgs[1]).toBe(false);        // isCurrentlyCompleted  
    expect(callArgs[2]).toBe(10);           // xpReward
  });

  test('calls onViewDetails when content area is clicked', () => {
    // Act
    render(
      <MissionCard 
        mission={mockMission}
        onToggleComplete={mockOnToggleComplete}
        onViewDetails={mockOnViewDetails}
      />
    );

    const contentArea = screen.getByText('Do laundry').closest('.content-area');
    fireEvent.click(contentArea);

    // Assert
    expect(mockOnViewDetails).toHaveBeenCalledWith(mockMission);
  });

  test('applies completed styling to completed missions', () => {
    // Arrange
    const completedMission = {
      ...mockMission,
      status: 'completed'
    };

    // Act
    render(
      <MissionCard 
        mission={completedMission}
        onToggleComplete={mockOnToggleComplete}
        onViewDetails={mockOnViewDetails}
      />
    );

    // Assert
    const card = screen.getByText('Do laundry').closest('.mission-card');
    expect(card).toHaveClass('completed');
  });

  test('handles missions with due dates', () => {
    // Arrange
    const today = new Date();
    const missionWithDueDate = {
      ...mockMission,
      dueDate: today
    };

    // Act
    render(
      <MissionCard 
        mission={missionWithDueDate}
        onToggleComplete={mockOnToggleComplete}
        onViewDetails={mockOnViewDetails}
      />
    );

    // Assert
    expect(screen.getByText('Due Today')).toBeInTheDocument();
  });

  test('handles overdue missions', () => {
    // Arrange
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const overdueMission = {
      ...mockMission,
      dueDate: yesterday
    };

    // Act
    render(
      <MissionCard 
        mission={overdueMission}
        onToggleComplete={mockOnToggleComplete}
        onViewDetails={mockOnViewDetails}
      />
    );

    // Assert
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    const dueDateBadge = screen.getByText('Overdue');
    expect(dueDateBadge).toHaveClass('overdue');
  });
});